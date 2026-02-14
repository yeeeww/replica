import csv
import json
import os
import random
import time
import io
import hashlib
import signal
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import RealDictCursor

# ============================================
# t3.small (2GB) 속도 최적화 설정
# ============================================
SPEED_MODE = os.environ.get("CRAWL_SPEED_MODE", "normal")  # "fast" 또는 "normal"

if SPEED_MODE == "fast":
    MAX_WORKERS = 10         # 동시 처리 워커 수 (2GB에서 안전한 최대치)
    BATCH_SIZE = 40          # 배치 크기
    SLEEP_BETWEEN_BATCH = 0.15  # 배치 간 대기 시간
    SLEEP_BETWEEN_REQUEST = 0.08  # 요청 간 최소 대기
    URL_COLLECT_WORKERS = 5   # URL 수집 동시 요청 수
else:
    MAX_WORKERS = 7          # 동시 처리 워커 수
    BATCH_SIZE = 30          # 배치 크기
    SLEEP_BETWEEN_BATCH = 0.3  # 배치 간 대기 시간
    SLEEP_BETWEEN_REQUEST = 0.15  # 요청 간 최소 대기
    URL_COLLECT_WORKERS = 4   # URL 수집 동시 요청 수
# ============================================
SKIP_S3_UPLOAD = os.environ.get("CRAWL_SKIP_S3", "false").lower() == "true"
# ============================================

# 중지 플래그 확인
STOP_FLAG_PATH = os.environ.get("CRAWL_STOP_FLAG", "")
STOP_REQUESTED = False

def check_stop_flag():
    """중지 요청 확인"""
    global STOP_REQUESTED
    if STOP_REQUESTED:
        return True
    if STOP_FLAG_PATH and os.path.exists(STOP_FLAG_PATH):
        STOP_REQUESTED = True
        print("\n[STOP] 중지 요청 감지됨! 크롤링을 종료합니다...")
        return True
    return False

def signal_handler(signum, frame):
    """시그널 핸들러 (SIGTERM, SIGINT)"""
    global STOP_REQUESTED
    STOP_REQUESTED = True
    print(f"\n[STOP] 시그널 {signum} 수신됨. 크롤링을 종료합니다...")
    sys.exit(0)

# 시그널 핸들러 등록
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# AWS S3 설정
try:
    import boto3
    from botocore.exceptions import ClientError
    S3_ENABLED = True
except ImportError:
    S3_ENABLED = False
    print("[WARNING] boto3가 설치되어 있지 않습니다. pip install boto3로 설치해주세요.")

# AWS S3 설정
AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-2")
AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "wiznoble-image")
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")

# S3 클라이언트 초기화
s3_client = None
if S3_ENABLED and AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    try:
        s3_client = boto3.client(
            's3',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
        print(f"[S3] AWS S3 연결 성공: {AWS_S3_BUCKET}")
    except Exception as e:
        print(f"[S3 ERROR] S3 클라이언트 초기화 실패: {e}")
        s3_client = None


def upload_image_to_s3(image_url: str, prefix: str = "crawled") -> Optional[str]:
    """
    외부 이미지 URL을 다운로드하여 S3에 업로드
    Returns: S3 URL 또는 None (실패 시)
    """
    if not s3_client:
        return image_url  # S3 사용 불가 시 원본 URL 반환
    
    if not image_url or not image_url.startswith("http"):
        return image_url
    
    try:
        # 이미지 다운로드
        response = http_session.get(image_url, timeout=30)
        if response.status_code != 200:
            print(f"[S3] 이미지 다운로드 실패: {image_url}")
            return image_url
        
        # 파일 확장자 결정
        content_type = response.headers.get('Content-Type', 'image/jpeg')
        ext_map = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
        }
        ext = ext_map.get(content_type, '.jpg')
        
        # URL에서 확장자 추출 시도
        parsed = urlparse(image_url)
        path_ext = os.path.splitext(parsed.path)[1].lower()
        if path_ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            ext = path_ext if path_ext != '.jpeg' else '.jpg'
        
        # 고유 파일명 생성 (URL 해시 + 타임스탬프)
        url_hash = hashlib.md5(image_url.encode()).hexdigest()[:12]
        timestamp = int(time.time() * 1000)
        s3_key = f"{prefix}/{timestamp}_{url_hash}{ext}"
        
        # S3에 업로드
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=s3_key,
            Body=response.content,
            ContentType=content_type,
        )
        
        # S3 URL 반환
        s3_url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
        return s3_url
    
    except Exception as e:
        print(f"[S3 ERROR] 이미지 업로드 실패 ({image_url}): {e}")
        return image_url  # 실패 시 원본 URL 반환


def upload_images_batch_to_s3(image_urls: List[str], prefix: str = "crawled") -> List[str]:
    """
    여러 이미지를 병렬로 S3에 업로드 (순서 보장)
    Returns: S3 URL 리스트 (원래 순서 유지)
    """
    if not s3_client or not image_urls:
        return image_urls
    
    # 순서 보장을 위해 인덱스와 함께 처리
    s3_urls = [None] * len(image_urls)
    
    with ThreadPoolExecutor(max_workers=3) as executor:  # S3 업로드는 3개로 제한
        # (index, url) 튜플로 제출하여 순서 추적
        futures = {
            executor.submit(upload_image_to_s3, url, prefix): (idx, url) 
            for idx, url in enumerate(image_urls)
        }
        for future in as_completed(futures):
            idx, original_url = futures[future]
            try:
                s3_url = future.result()
                s3_urls[idx] = s3_url  # 원래 위치에 저장
            except Exception as e:
                print(f"[S3 ERROR] 배치 업로드 실패: {e}")
                s3_urls[idx] = original_url  # 실패 시 원본 URL 유지
    
    return s3_urls


# 설정
SITEMAP_URL = "https://replmoa1.com/sitemap3.xml"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/91.0.4472.124 Safari/537.36"
    )
}

# HTTP Session (연결 재사용 → TCP handshake 절약, 속도 2~3배 향상)
http_session = requests.Session()
http_session.headers.update(HEADERS)
# 연결 풀 크기를 워커 수에 맞춰 설정
adapter = requests.adapters.HTTPAdapter(
    pool_connections=MAX_WORKERS + URL_COLLECT_WORKERS,
    pool_maxsize=MAX_WORKERS + URL_COLLECT_WORKERS,
    max_retries=2
)
http_session.mount('https://', adapter)
http_session.mount('http://', adapter)
CSV_FILENAME = "replmoa_products.csv"
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", "5432")),
    "dbname": os.environ.get("DB_NAME", "modern_shop"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "1234"),
}
_raw_limit = os.environ.get("CRAWL_LIMIT", "500")
MAX_SAVE = 999999 if _raw_limit == "0" else int(_raw_limit)  # 0 = 무제한 (전체 크롤링)
CATEGORY_FILTER = os.environ.get("CRAWL_CATEGORY", "")  # 예: "남성", "여성", "남성 > 지갑" 등
URL_SOURCE = os.environ.get("CRAWL_URL_SOURCE", "both")  # "sitemap", "category", "both"
MAX_DB_PRICE = 9999999999999.99  # numeric(15,2) 확장 후 상한 (약 10조원)

# 메모리 관리를 위한 gc import
import gc


def slugify(txt: str) -> str:
    """텍스트를 URL-safe 슬러그로 변환"""
    import re
    slug = (
        re.sub(r"[^0-9a-zA-Z가-힣\-]+", "-", txt.strip().lower())
        .strip("-")
        .replace("--", "-")
    )
    return slug or "etc"


def normalize_category_4depth(cat_raw: str) -> Dict[str, any]:
    """
    '남성 > 가방 > 고야드 > 크로스&숄더백' 형태를 4뎁스 카테고리 정보로 변환
    3뎁스('남성 > 지갑 > 프라다')도 호환 처리
    """
    parts = [p.strip() for p in cat_raw.split(">") if p.strip()]
    
    # 대분류 매핑
    main_map = {
        "남성": "men",
        "여성": "women",
        "국내출고상품": "domestic",
        "국내출고 상품": "domestic",
        "국내출고": "domestic",
        "국내 출고": "domestic",
    }
    
    # 중분류 매핑 (상품 종류)
    sub_map = {
        "가방": "bag",
        "지갑": "wallet",
        "시계": "watch",
        "신발": "shoes",
        "벨트": "belt",
        "악세서리": "accessory",
        "액세서리": "accessory",
        "모자": "hat",
        "의류": "clothing",
        "선글라스&안경": "glasses",
        "선글라스": "glasses",
        "안경": "glasses",
        "기타": "etc",
        "가방&지갑": "bag-wallet",
        "패션잡화": "fashion",
        "생활&주방용품": "home",
        "향수": "perfume",
        "라이터": "lighter",
    }
    
    # 세부 카테고리 매핑 (depth4 - 가방/지갑/신발/의류 하위 등)
    detail_map = {
        # 가방 하위
        "크로스&숄더백": "crossbody-shoulder",
        "크로스백": "crossbody",
        "숄더백": "shoulder",
        "토트백": "tote",
        "클러치": "clutch",
        "클러치&파우치": "clutch-pouch",
        "파우치": "pouch",
        "백팩": "backpack",
        "서류가방": "briefcase",
        "여행가방": "luggage",
        "미니백": "mini",
        "핸드백": "handbag",
        "호보백": "hobo",
        "버킷백": "bucket",
        # 지갑 하위
        "카드지갑": "card-wallet",
        "반지갑": "half-wallet",
        "장지갑": "long-wallet",
        "지퍼월렛": "zip-wallet",
        "코인지갑": "coin-wallet",
        "키홀더": "key-holder",
        # 신발 하위
        "스니커즈": "sneakers",
        "로퍼": "loafer",
        "부츠": "boots",
        "샌들": "sandal",
        "슬리퍼": "slipper",
        "힐": "heel",
        "플랫": "flat",
        "뮬": "mule",
        # 의류 하위
        "아우터": "outer",
        "자켓": "jacket",
        "코트": "coat",
        "패딩": "padding",
        "다운": "down",
        "점퍼": "jumper",
        "상의": "top",
        "티셔츠": "tshirt",
        "반팔": "short-sleeve",
        "긴팔": "long-sleeve",
        "니트": "knit",
        "맨투맨": "sweatshirt",
        "후드": "hoodie",
        "셔츠": "shirt",
        "블라우스": "blouse",
        "하의": "bottom",
        "팬츠": "pants",
        "바지": "pants",
        "청바지": "jeans",
        "데님": "denim",
        "스커트": "skirt",
        "치마": "skirt",
        "반바지": "shorts",
        "원피스": "dress",
        "드레스": "dress",
        "정장": "suit",
        "트레이닝": "training",
        "세트": "set",
        # 악세서리 하위
        "목걸이": "necklace",
        "팔찌": "bracelet",
        "반지": "ring",
        "귀걸이": "earring",
        "브로치": "brooch",
        "스카프": "scarf",
        "머플러": "muffler",
        "넥타이": "necktie",
        "장갑": "gloves",
        "양말": "socks",
    }
    
    result = {
        "depth1": None,
        "depth2": None,
        "depth3": None,
        "depth4": None,
        "full_name": cat_raw,
        "leaf_slug": None,
    }
    
    # 대분류 (depth1) - 성별/유형: 남성, 여성, 국내출고상품
    if parts:
        main_name = parts[0]
        main_slug = main_map.get(main_name, slugify(main_name))
        result["depth1"] = {"name": main_name, "slug": main_slug}
        result["leaf_slug"] = main_slug
    
    # 중분류 (depth2) - 상품 종류: 가방, 지갑, 시계 등
    if len(parts) > 1:
        sub_name = parts[1]
        sub_slug_base = sub_map.get(sub_name, slugify(sub_name))
        sub_slug = f"{result['depth1']['slug']}-{sub_slug_base}"
        result["depth2"] = {"name": sub_name, "slug": sub_slug, "parent_slug": result["depth1"]["slug"]}
        result["leaf_slug"] = sub_slug
    
    # 소분류 (depth3) - 브랜드: 고야드, 프라다, 구찌 등
    if len(parts) > 2:
        brand_name = parts[2]
        brand_slug = f"{result['depth2']['slug']}-{slugify(brand_name)}"
        result["depth3"] = {"name": brand_name, "slug": brand_slug, "parent_slug": result["depth2"]["slug"]}
        result["leaf_slug"] = brand_slug
    
    # 세부분류 (depth4) - 세부 카테고리: 크로스&숄더백, 토트백 등
    if len(parts) > 3:
        detail_name = parts[3]
        detail_slug_base = detail_map.get(detail_name, slugify(detail_name))
        detail_slug = f"{result['depth3']['slug']}-{detail_slug_base}"
        result["depth4"] = {"name": detail_name, "slug": detail_slug, "parent_slug": result["depth3"]["slug"]}
        result["leaf_slug"] = detail_slug
    
    return result


# 기존 3뎁스 호환 래퍼
def normalize_category_3depth(cat_raw: str) -> Dict[str, any]:
    """기존 호환용 - normalize_category_4depth의 래퍼"""
    return normalize_category_4depth(cat_raw)


def normalize_category(cat_raw: str) -> Dict[str, str]:
    """기존 호환용 - 최종 카테고리 정보만 반환"""
    cat_info = normalize_category_4depth(cat_raw)
    
    name_parts = []
    for depth_key in ["depth1", "depth2", "depth3", "depth4"]:
        if cat_info[depth_key]:
            name_parts.append(cat_info[depth_key]["name"])
    
    name = " > ".join(name_parts) if name_parts else "기타"
    
    return {"name": name, "slug": cat_info["leaf_slug"] or "etc"}


def get_product_urls_from_sitemap() -> List[str]:
    """사이트맵에서 상품 상세 페이지 URL을 추출합니다."""
    print(f"[SITEMAP] 사이트맵 불러오는 중: {SITEMAP_URL}")
    try:
        response = http_session.get(SITEMAP_URL, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "xml")

        urls: List[str] = []
        for loc in soup.find_all("loc"):
            url = loc.text
            if "item.php" in url:
                urls.append(url)

        print(f"[SITEMAP] 사이트맵에서 {len(urls)}개의 상품 URL 발견")
        return urls
    except Exception as exc:
        print(f"[SITEMAP] 사이트맵 로드 실패: {exc}")
        return []


# ============================================
# 카테고리 리스트 페이지 기반 URL 수집
# ============================================
BASE_URL = "https://replmoa1.com"

# 알려진 최상위 카테고리 ID
KNOWN_TOP_CATEGORIES = {
    "10": "남성",
    "20": "여성",
    "30": "국내출고상품",
}



def get_product_urls_from_category_page(ca_id: str, page: int = 1) -> List[str]:
    """
    카테고리 리스트 페이지에서 상품 URL을 추출합니다.
    Returns: 해당 페이지의 상품 URL 리스트 (빈 리스트면 마지막 페이지)
    """
    import re
    url = f"{BASE_URL}/shop/list.php?ca_id={ca_id}&page={page}"
    try:
        time.sleep(SLEEP_BETWEEN_REQUEST)
        response = http_session.get(url, timeout=15)
        if response.status_code != 200:
            return []
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # 상품 링크 추출 (item.php?it_id=xxxxx)
        # "베스트상품" 영역 제외 - 실제 리스트 상품만 추출
        product_urls = []
        seen = set()
        
        # 베스트상품 it_id를 먼저 수집하여 제외
        best_ids = set()
        best_section = soup.select_one(".best_item, .best_products, #best")
        if best_section:
            for a_tag in best_section.find_all("a", href=True):
                m = re.search(r"it_id=(\d+)", a_tag["href"])
                if m:
                    best_ids.add(m.group(1))
        
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            if "item.php" in href and "it_id=" in href:
                match = re.search(r"it_id=(\d+)", href)
                if match:
                    it_id = match.group(1)
                    if it_id not in seen:
                        seen.add(it_id)
                        clean_url = f"{BASE_URL}/shop/item.php?it_id={it_id}"
                        product_urls.append(clean_url)
        
        return product_urls
        
    except Exception as e:
        print(f"[CATEGORY] 페이지 로드 실패 ({ca_id}, page={page}): {e}")
        return []


def _fetch_category_page_batch(ca_id: str, pages: List[int]) -> Dict[int, List[str]]:
    """여러 페이지를 병렬로 가져옵니다."""
    results = {}
    
    def fetch_one(page):
        return page, get_product_urls_from_category_page(ca_id, page)
    
    with ThreadPoolExecutor(max_workers=URL_COLLECT_WORKERS) as executor:
        futures = {executor.submit(fetch_one, p): p for p in pages}
        for future in as_completed(futures):
            try:
                page, urls = future.result()
                results[page] = urls
            except Exception:
                results[futures[future]] = []
    
    return results


def get_product_urls_from_categories(category_filter: str = "") -> List[str]:
    """
    최상위 카테고리(남성/여성/국내출고) 리스트 페이지를 끝까지 순회하며 
    모든 상품 URL을 수집합니다.
    
    병렬 페이지 수집: 한 번에 여러 페이지를 동시에 요청하여 수집 속도를 대폭 향상합니다.
    """
    import re
    print("[CATEGORY] 카테고리 리스트 페이지에서 상품 URL 수집 시작...")
    print(f"[CATEGORY] 병렬 수집 모드 (동시 {URL_COLLECT_WORKERS}페이지씩)")
    
    # 크롤링 대상 최상위 카테고리 결정
    target_categories = dict(KNOWN_TOP_CATEGORIES)
    
    if category_filter:
        filter_lower = category_filter.lower().strip().split(">")[0].strip()
        filtered = {}
        for ca_id, name in KNOWN_TOP_CATEGORIES.items():
            if filter_lower in name.lower():
                filtered[ca_id] = name
        if filtered:
            target_categories = filtered
            print(f"[CATEGORY] 필터 '{category_filter}' 적용: {list(target_categories.values())}")
    
    all_urls = []
    seen_urls = set()
    
    for ca_id, cat_name in target_categories.items():
        if check_stop_flag():
            break
        
        print(f"[CATEGORY] === '{cat_name}' (ca_id={ca_id}) 병렬 페이지 순회 시작 ===")
        page = 1
        max_pages = 2000
        cat_urls = 0
        consecutive_no_new = 0
        finished = False
        
        while page <= max_pages and not finished:
            if check_stop_flag():
                break
            
            # 한 번에 URL_COLLECT_WORKERS 페이지씩 병렬 수집
            page_batch = list(range(page, min(page + URL_COLLECT_WORKERS, max_pages + 1)))
            batch_results = _fetch_category_page_batch(ca_id, page_batch)
            
            # 순서대로 처리 (페이지 번호 순)
            for p in sorted(batch_results.keys()):
                if check_stop_flag():
                    finished = True
                    break
                
                urls = batch_results[p]
                
                # 상품이 없으면 마지막 페이지
                if not urls:
                    print(f"[CATEGORY] '{cat_name}' page={p}: 상품 없음 → 완료")
                    finished = True
                    break
                
                # 현재 페이지의 it_id 추출
                current_ids = set()
                for u in urls:
                    m = re.search(r"it_id=(\d+)", u)
                    if m:
                        current_ids.add(m.group(1))
                
                new_count = 0
                for url in urls:
                    if url not in seen_urls:
                        seen_urls.add(url)
                        all_urls.append(url)
                        new_count += 1
                        cat_urls += 1
                
                # 새 URL이 없으면 카운트
                if new_count == 0:
                    consecutive_no_new += 1
                    if consecutive_no_new >= 3:
                        print(f"[CATEGORY] '{cat_name}' page={p}: 3페이지 연속 새 URL 없음 → 완료")
                        finished = True
                        break
                else:
                    consecutive_no_new = 0
            
            # 진행 상황 로그
            if page % 50 < URL_COLLECT_WORKERS:
                print(f"[CATEGORY] '{cat_name}' page~{page + len(page_batch) - 1}: 누적 {cat_urls}개 수집 중...")
            
            page += len(page_batch)
        
        print(f"[CATEGORY] '{cat_name}': 총 {cat_urls}개 상품 URL 수집 완료 (~{page-1}페이지)")
    
    print(f"[CATEGORY] 카테고리 리스트에서 총 {len(all_urls)}개 상품 URL 수집 완료")
    return all_urls


def get_product_urls() -> List[str]:
    """사이트맵과 카테고리 리스트 페이지를 병합하여 상품 URL을 수집합니다."""
    all_urls = []
    seen = set()
    
    source = URL_SOURCE.lower().strip()
    
    # 1. 사이트맵에서 수집
    if source in ("sitemap", "both"):
        sitemap_urls = get_product_urls_from_sitemap()
        for url in sitemap_urls:
            # URL 정규화
            clean = url.strip()
            if clean and clean not in seen:
                seen.add(clean)
                all_urls.append(clean)
        print(f"[COLLECT] 사이트맵에서 {len(sitemap_urls)}개 수집 (중복 제거 후: {len(all_urls)}개)")
    
    # 2. 카테고리 리스트 페이지에서 수집
    if source in ("category", "both"):
        category_urls = get_product_urls_from_categories(CATEGORY_FILTER)
        new_from_category = 0
        for url in category_urls:
            clean = url.strip()
            if clean and clean not in seen:
                seen.add(clean)
                all_urls.append(clean)
                new_from_category += 1
        print(f"[COLLECT] 카테고리 페이지에서 {len(category_urls)}개 수집 (신규: {new_from_category}개)")
    
    # 3. URL 셔플 (특정 카테고리에 편중되지 않도록)
    random.shuffle(all_urls)
    
    print(f"[COLLECT] 총 {len(all_urls)}개 고유 상품 URL 수집 완료")
    return all_urls


def parse_product_options(soup: BeautifulSoup) -> List[Dict[str, any]]:
    """상품 옵션(사이즈, 컬러 등)을 추출합니다."""
    options = []
    
    option_selectors = [
        "#sit_opt_added select",
        ".sit_opt_added select",
        "#sit_option select",
        ".sit_option select",
        "select[name^='opt']",
        "select[id^='it_opt']",
        ".item_option select",
    ]
    
    for selector in option_selectors:
        for select_tag in soup.select(selector):
            option_name = ""
            label = select_tag.find_previous("label")
            if label:
                option_name = label.get_text(strip=True)
            else:
                prev = select_tag.find_previous(string=True)
                if prev:
                    option_name = prev.strip().rstrip(":")
            
            if not option_name:
                name_attr = select_tag.get("name", "") or select_tag.get("id", "")
                if "color" in name_attr.lower() or "컬러" in name_attr:
                    option_name = "컬러"
                elif "size" in name_attr.lower() or "사이즈" in name_attr:
                    option_name = "사이즈"
                else:
                    option_name = "옵션"
            
            option_values = []
            for opt in select_tag.find_all("option"):
                val = opt.get_text(strip=True)
                if val and "선택" not in val and val != "-":
                    import re
                    price_add = 0
                    if "(" in val and "원" in val:
                        price_match = re.search(r"\(([+-]?\s*[\d,]+)\s*원\)", val)
                        if price_match:
                            price_str = price_match.group(1).replace(",", "").replace(" ", "")
                            try:
                                price_add = int(price_str)
                            except:
                                pass
                        val = re.sub(r"\([+-]?\s*[\d,]+\s*원\)", "", val).strip()
                    
                    val = re.sub(r"\s*[+-]\s*\d+\s*원", "", val).strip()
                    
                    if val:
                        option_values.append({
                            "value": val,
                            "price_add": price_add
                        })
            
            if option_values:
                options.append({
                    "name": option_name,
                    "values": option_values
                })
    
    seen_names = set()
    unique_options = []
    for opt in options:
        if opt["name"] not in seen_names:
            seen_names.add(opt["name"])
            unique_options.append(opt)
    
    return unique_options


def parse_product_detail(url: str, upload_to_s3: bool = True) -> Optional[Dict[str, any]]:
    """개별 상품 페이지에서 정보를 추출합니다."""
    try:
        response = http_session.get(url, timeout=15)
        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.text, "html.parser")

        # 1. 상품명 추출
        title_tag = soup.select_one("#sit_title") or soup.select_one(".stitle")
        title = title_tag.text.strip() if title_tag else "상품명 없음"

        # 2. 카테고리 추출
        category = ""
        sit_ov = soup.select_one("#sit_ov")
        if sit_ov:
            text_candidates = [
                t.strip()
                for t in sit_ov.stripped_strings
                if ">" in t and "상품간략정보" not in t
            ]
            if text_candidates:
                category = text_candidates[0]

        # 3. 시중가격 / 판매가격
        market_price = ""
        sale_price = ""
        market_tag = soup.select_one(".price_wr.price_og span")
        sale_tag = soup.select_one(".price_wr.price span")
        if market_tag:
            market_price = market_tag.get_text(strip=True)
        if sale_tag:
            sale_price = sale_tag.get_text(strip=True)

        # 4. 대표 이미지 URL 추출
        img_tag = soup.select_one("#sit_pvi_big img") or soup.select_one(".sit_pvi img")
        img_url = ""
        if img_tag:
            img_url = img_tag.get("src", "")
            if img_url and not img_url.startswith("http"):
                img_url = "https://replmoa1.com" + img_url

        # 5. 상세 설명 내 이미지들 추출
        desc_img_urls: List[str] = []
        seen = set()
        
        if img_url:
            seen.add(img_url)
            desc_img_urls.append(img_url)
        
        desc_selectors = [
            "#sit_inf_explan img",
            "#sit_inf img",
            ".sit_inf img", 
            "#sit_desc img",
            ".sit_desc img",
            ".item_explan img",
            ".product-detail img",
            ".view_content img",
            "#goods_spec img",
            ".goods_description img",
            ".detail_cont img",
            "[class*='detail'] img",
            "[class*='desc'] img",
            "[id*='detail'] img",
            ".product-content img",
            ".goods-view img",
            ".item-detail img",
            "#prdDetail img",
            ".detailArea img",
        ]
        
        for selector in desc_selectors:
            try:
                tags = soup.select(selector)
                for tag in tags:
                    src = tag.get("src") or tag.get("data-src") or tag.get("data-original") or tag.get("data-lazy") or ""
                    if not src:
                        continue
                    
                    abs_src = urljoin("https://replmoa1.com", src)
                    
                    if not any(ext in abs_src.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                        continue
                    
                    width = tag.get("width", "")
                    height = tag.get("height", "")
                    try:
                        if width and int(width) < 50:
                            continue
                        if height and int(height) < 50:
                            continue
                    except:
                        pass
                    
                    if abs_src not in seen:
                        seen.add(abs_src)
                        desc_img_urls.append(abs_src)
            except Exception as e:
                continue

        # 6. 옵션 추출
        options = parse_product_options(soup)

        # 7. S3에 이미지 업로드 (SKIP_S3_UPLOAD=true이면 원본 URL 그대로 사용)
        if not SKIP_S3_UPLOAD and upload_to_s3 and s3_client:
            if img_url:
                s3_img_url = upload_image_to_s3(img_url, prefix="products")
                if s3_img_url and s3_img_url != img_url:
                    img_url = s3_img_url
            
            if desc_img_urls:
                s3_desc_urls = upload_images_batch_to_s3(desc_img_urls, prefix="products/desc")
                desc_img_urls = s3_desc_urls

        return {
            "상품명": title,
            "카테고리": category,
            "시중가격": market_price,
            "판매가격": sale_price,
            "대표이미지": img_url,
            "설명이미지들": ";".join(desc_img_urls),
            "URL": url,
            "옵션": options,
        }

    except Exception as exc:
        print(f"파싱 에러 ({url}): {exc}")
        return None


def main() -> None:
    import threading
    from collections import deque

    speed_label = "⚡ 고속" if SPEED_MODE == "fast" else "일반"
    s3_label = "스킵 (원본 URL 사용)" if SKIP_S3_UPLOAD else "활성화"
    print(f"[CONFIG] 모드: {speed_label}, 워커: {MAX_WORKERS}, 배치: {BATCH_SIZE}, 대기: {SLEEP_BETWEEN_BATCH}s")
    print(f"[CONFIG] S3 업로드: {s3_label}, URL 수집 병렬: {URL_COLLECT_WORKERS}페이지")

    # ============================================
    # 1단계: 사이트맵 URL 빠르게 수집 (즉시 처리 시작용)
    # ============================================
    source = URL_SOURCE.lower().strip()
    seen_urls = set()
    urls = []

    if source in ("sitemap", "both"):
        sitemap_urls = get_product_urls_from_sitemap()
        for url in sitemap_urls:
            clean = url.strip()
            if clean and clean not in seen_urls:
                seen_urls.add(clean)
                urls.append(clean)
        print(f"[COLLECT] 사이트맵에서 {len(urls)}개 수집 → 즉시 처리 시작!")
    
    # 카테고리 URL을 백그라운드에서 수집하여 큐에 추가
    category_url_queue = deque()
    category_collect_done = threading.Event()
    
    def background_category_collect():
        """백그라운드에서 카테고리 URL을 수집하여 큐에 넣는 스레드"""
        if source not in ("category", "both"):
            category_collect_done.set()
            return
        
        print("[CATEGORY-BG] 백그라운드 카테고리 URL 수집 시작...")
        cat_urls = get_product_urls_from_categories(CATEGORY_FILTER)
        new_count = 0
        for url in cat_urls:
            clean = url.strip()
            if clean and clean not in seen_urls:
                seen_urls.add(clean)
                category_url_queue.append(clean)
                new_count += 1
        print(f"[CATEGORY-BG] 카테고리에서 신규 {new_count}개 추가 완료")
        category_collect_done.set()
    
    # 백그라운드 스레드 시작
    cat_thread = threading.Thread(target=background_category_collect, daemon=True)
    cat_thread.start()

    if not urls and source == "category":
        # 카테고리 전용 모드: 첫 배치가 올 때까지 잠시 대기
        print("[COLLECT] 카테고리 URL 수집 대기 중...")
        while len(category_url_queue) == 0 and not category_collect_done.is_set():
            time.sleep(1)
        urls = list(category_url_queue)
        category_url_queue.clear()
    
    if not urls and category_collect_done.is_set():
        print("상품 URL을 찾지 못해 종료합니다.")
        return

    random.shuffle(urls)
    print(f"크롤링 시작 (초기 {len(urls)}개 + 카테고리 추가 수집 중)...")

    # 2. DB 연결
    if not DB_CONFIG["password"]:
        print("[ERROR] DB_PASSWORD 환경변수가 비어있습니다.")
        return

    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=RealDictCursor)

    def slugify(text: str) -> str:
        import re
        slug = (
            re.sub(r"[^0-9a-zA-Z\-]+", "-", text.strip().lower())
            .strip("-")
            .replace("--", "-")
        )
        return slug or "etc"

    def ensure_category_single(name: str, slug: str, parent_id: int = None, parent_slug: str = None, depth: int = 1) -> int:
        cur.execute("SELECT id FROM categories WHERE slug=%s", (slug,))
        row = cur.fetchone()
        if row:
            if parent_slug:
                cur.execute(
                    "UPDATE categories SET parent_slug=%s WHERE slug=%s AND (parent_slug IS NULL OR parent_slug = '')",
                    (parent_slug, slug)
                )
            return row["id"]
        cur.execute(
            "INSERT INTO categories (name, slug, parent_id, parent_slug, depth, description) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (name, slug, parent_id, parent_slug, depth, "imported from crawler"),
        )
        return cur.fetchone()["id"]

    def ensure_category_4depth(cat_raw: str) -> int:
        cat_info = normalize_category_4depth(cat_raw)
        
        parent_id = None
        parent_slug = None
        final_id = None
        
        if cat_info["depth1"]:
            d1 = cat_info["depth1"]
            parent_id = ensure_category_single(d1["name"], d1["slug"], None, None, 1)
            parent_slug = d1["slug"]
            final_id = parent_id
        
        if cat_info["depth2"]:
            d2 = cat_info["depth2"]
            parent_id = ensure_category_single(d2["name"], d2["slug"], parent_id, parent_slug, 2)
            parent_slug = d2["slug"]
            final_id = parent_id
        
        if cat_info["depth3"]:
            d3 = cat_info["depth3"]
            parent_id = ensure_category_single(d3["name"], d3["slug"], parent_id, parent_slug, 3)
            parent_slug = d3["slug"]
            final_id = parent_id
        
        if cat_info["depth4"]:
            d4 = cat_info["depth4"]
            final_id = ensure_category_single(d4["name"], d4["slug"], parent_id, parent_slug, 4)
        
        return final_id or ensure_category_single("기타", "etc", None, None, 1)

    # 기존 호환용
    def ensure_category_3depth(cat_raw: str) -> int:
        return ensure_category_4depth(cat_raw)

    def already_exists(name: str, category_id: int) -> bool:
        cur.execute(
            "SELECT id FROM products WHERE name=%s AND category_id=%s",
            (name, category_id),
        )
        return cur.fetchone() is not None

    # URL 기반 빠른 중복 체크용 캐시 (it_id → True)
    # DB에 저장된 상품의 URL에서 it_id를 추출하여 캐시
    existing_it_ids = set()
    try:
        import re as _re
        cur.execute("SELECT description FROM products WHERE description LIKE '%it_id=%'")
        for row in cur:
            m = _re.search(r"it_id=(\d+)", row["description"])
            if m:
                existing_it_ids.add(m.group(1))
        print(f"[SKIP] 기존 상품 {len(existing_it_ids)}개의 it_id 캐시 완료")
    except Exception as e:
        print(f"[SKIP] it_id 캐시 로드 실패 (무시): {e}")

    def is_already_crawled_by_url(url: str) -> bool:
        """URL의 it_id로 빠르게 중복 체크 (DB 쿼리 없이 메모리에서)"""
        import re as _re
        m = _re.search(r"it_id=(\d+)", url)
        if m and m.group(1) in existing_it_ids:
            return True
        return False

    def save_product_options(product_id: int, options: List[Dict]) -> int:
        option_count = 0
        for option in options:
            option_name = option.get("name", "옵션")
            for val_info in option.get("values", []):
                val = val_info.get("value", "")
                price_add = val_info.get("price_add", 0)
                if val:
                    cur.execute(
                        """
                        INSERT INTO product_options (product_id, option_name, option_value, price_adjustment, stock)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        (product_id, option_name, val, price_add, 10),
                    )
                    option_count += 1
        return option_count

    def matches_category_filter(product_category: str) -> bool:
        if not CATEGORY_FILTER:
            return True
        
        product_cat_lower = product_category.lower().strip()
        filter_lower = CATEGORY_FILTER.lower().strip()
        
        if product_cat_lower.startswith(filter_lower):
            return True
        
        filter_parts = [p.strip() for p in filter_lower.split(">")]
        product_parts = [p.strip() for p in product_cat_lower.split(">")]
        
        if len(filter_parts) <= len(product_parts):
            match = all(
                filter_parts[i] == product_parts[i] 
                for i in range(len(filter_parts))
            )
            if match:
                return True
        
        return False
    
    if CATEGORY_FILTER:
        print(f"[FILTER] 카테고리 필터 적용: '{CATEGORY_FILTER}'")

    def to_price(val: str) -> float:
        digits = "".join([c for c in val if c.isdigit()])
        return float(digits) if digits else 0.0

    def fetch_and_filter(url_idx_tuple):
        idx, url = url_idx_tuple
        try:
            # 빠른 중복 체크 (파싱 전에 it_id로 확인 → 네트워크 요청 절약)
            if is_already_crawled_by_url(url):
                return None, idx, url, "이미 수집된 상품 (스킵)"
            
            info = parse_product_detail(url)
            if not info:
                return None, idx, url, "파싱 실패"
            
            product_category = info.get("카테고리") or "기타"
            if not matches_category_filter(product_category):
                return None, idx, url, f"카테고리 불일치: {product_category}"
            
            return info, idx, url, None
        except Exception as e:
            return None, idx, url, str(e)

    count = 0
    scanned = 0
    retry_urls = []  # 타임아웃/에러 발생한 URL (나중에 재시도)
    
    def save_product_to_db(info):
        nonlocal count
        
        product_category = info.get("카테고리") or "기타"
        category_id = ensure_category_4depth(product_category)

        if already_exists(info["상품명"], category_id):
            return False

        price_val = to_price(info.get("판매가격") or "")
        department_price = to_price(info.get("시중가격") or "")
        
        if price_val and price_val > MAX_DB_PRICE:
            price_val = MAX_DB_PRICE
        if department_price and department_price > MAX_DB_PRICE:
            department_price = MAX_DB_PRICE
            
        description = f"{info.get('URL','')}\n{info.get('설명이미지들','')}".strip()
        image_url = info.get("대표이미지") or ""

        try:
            cur.execute(
                """
                INSERT INTO products (name, description, price, department_price, category_id, image_url, stock, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, true)
                RETURNING id
                """,
                (info["상품명"], description, price_val, 
                 department_price if department_price > 0 else None,
                 category_id, image_url, 10),
            )
            product_id = cur.fetchone()["id"]
        except Exception as exc:
            print(f"[ERROR] DB 저장 오류: {exc}")
            return False
        
        options = info.get("옵션", [])
        option_count = save_product_options(product_id, options) if options else 0
        
        count += 1
        sale = info.get("판매가격") or "가격 없음"
        opt_info = f", 옵션 {option_count}개" if option_count else ""
        cat_short = (info.get("카테고리") or "")[:20]
        print(f"  [+{count}] {info['상품명'][:35]} | {sale} | {cat_short}{opt_info}")
        
        # 저장 성공 시 it_id 캐시에 추가 (같은 세션 중복 방지)
        import re as _re
        m = _re.search(r"it_id=(\d+)", info.get("URL", ""))
        if m:
            existing_it_ids.add(m.group(1))
        
        return True

    # ============================================
    # 병렬 처리 (사이트맵 즉시 처리 + 카테고리 백그라운드 수집)
    # ============================================
    if SKIP_S3_UPLOAD:
        print(f"[S3] S3 업로드 스킵 모드 - 원본 이미지 URL을 그대로 사용합니다.")
    print(f"[SCAN] 병렬 크롤링 시작 (워커 {MAX_WORKERS}개, 배치 {BATCH_SIZE}개)...")
    print(f"[SCAN] 사이트맵 URL 즉시 처리 시작, 카테고리 URL은 백그라운드 수집 중...")
    
    start_time = time.time()
    batch_idx = 0
    url_index = 0  # 현재 처리 위치
    
    while True:
        # 중지 요청 확인
        if check_stop_flag():
            print(f"[STOP] 중지됨 - {count}개 저장 완료")
            break
        if count >= MAX_SAVE:
            print(f"[DONE] 목표 {MAX_SAVE}개 달성!")
            break
        
        # 카테고리 큐에서 새 URL 가져오기
        new_urls_added = 0
        while category_url_queue:
            try:
                new_url = category_url_queue.popleft()
                urls.append(new_url)
                new_urls_added += 1
            except IndexError:
                break
        if new_urls_added > 0 and new_urls_added >= 100:
            print(f"[QUEUE] 카테고리에서 {new_urls_added}개 URL 추가 (총 {len(urls)}개)")
        
        # 처리할 URL이 없고, 카테고리 수집도 끝났으면 종료
        if url_index >= len(urls):
            if category_collect_done.is_set():
                # 마지막으로 큐 비우기
                while category_url_queue:
                    try:
                        urls.append(category_url_queue.popleft())
                    except IndexError:
                        break
                if url_index >= len(urls):
                    print(f"[DONE] 모든 URL 처리 완료!")
                    break
            else:
                # 카테고리 수집 중이면 잠시 대기
                time.sleep(1)
                continue
        
        # 현재 배치 추출
        batch = urls[url_index:url_index + BATCH_SIZE]
        if not batch:
            time.sleep(0.5)
            continue
        
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(fetch_and_filter, (scanned + i + 1, url)): url 
                for i, url in enumerate(batch)
            }
            
            for future in as_completed(futures):
                if check_stop_flag():
                    executor.shutdown(wait=False, cancel_futures=True)
                    break
                
                info, idx, url, error = future.result()
                scanned += 1
                
                if info:
                    save_product_to_db(info)
                    if count >= MAX_SAVE:
                        break
                elif error and ("timed out" in str(error).lower() or "max retries" in str(error).lower()):
                    retry_urls.append(url)
        
        url_index += len(batch)
        batch_idx += 1
        
        # 진행률 표시 (5배치마다 = 더 자주)
        if batch_idx % 5 == 0:
            elapsed = time.time() - start_time
            rate = scanned / elapsed if elapsed > 0 else 0
            save_rate = count / elapsed if elapsed > 0 else 0
            total_known = len(urls)
            cat_status = "수집 중" if not category_collect_done.is_set() else "완료"
            remaining_urls = total_known - scanned
            remaining_sec = remaining_urls / rate if rate > 0 else 0
            
            # 시간 포맷 (시간/분/초)
            elapsed_m, elapsed_s = divmod(int(elapsed), 60)
            elapsed_h, elapsed_m = divmod(elapsed_m, 60)
            remain_m, remain_s = divmod(int(remaining_sec), 60)
            remain_h, remain_m = divmod(remain_m, 60)
            
            elapsed_str = f"{elapsed_h}시간 {elapsed_m}분" if elapsed_h > 0 else f"{elapsed_m}분 {elapsed_s}초"
            remain_str = f"{remain_h}시간 {remain_m}분" if remain_h > 0 else f"{remain_m}분 {remain_s}초"
            
            pct = scanned / total_known * 100 if total_known > 0 else 0
            print(f"[📊 진행] {scanned:,}/{total_known:,} 스캔 ({pct:.1f}%) | "
                  f"저장: {count:,}개 ({save_rate:.1f}개/초) | "
                  f"경과: {elapsed_str} | 남은시간: {remain_str} | "
                  f"카테고리URL: {cat_status}")
            
            if batch_idx % 20 == 0:
                gc.collect()
        
        time.sleep(SLEEP_BETWEEN_BATCH)
    
    # 카테고리 수집 스레드 종료 대기
    cat_thread.join(timeout=5)
    
    # ============================================
    # 실패한 URL 재시도 (최대 2회)
    # ============================================
    if retry_urls and not check_stop_flag() and count < MAX_SAVE:
        print(f"\n[RETRY] 타임아웃/에러 {len(retry_urls)}개 URL 재시도 시작...")
        retry_round = 0
        while retry_urls and retry_round < 2 and not check_stop_flag() and count < MAX_SAVE:
            retry_round += 1
            current_retry = list(retry_urls)
            retry_urls.clear()
            print(f"[RETRY] {retry_round}차 재시도: {len(current_retry)}개")
            
            for i in range(0, len(current_retry), BATCH_SIZE):
                if check_stop_flag() or count >= MAX_SAVE:
                    break
                batch = current_retry[i:i+BATCH_SIZE]
                
                with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                    futures = {
                        executor.submit(fetch_and_filter, (0, url)): url
                        for url in batch
                    }
                    for future in as_completed(futures):
                        info, idx, url, error = future.result()
                        if info:
                            save_product_to_db(info)
                        elif error and ("timed out" in str(error).lower() or "max retries" in str(error).lower()):
                            retry_urls.append(url)
                
                time.sleep(SLEEP_BETWEEN_BATCH * 2)  # 재시도는 좀 더 여유 있게
            
            print(f"[RETRY] {retry_round}차 완료 (남은 실패: {len(retry_urls)}개)")
        
        if retry_urls:
            print(f"[RETRY] 최종 실패: {len(retry_urls)}개 (삭제/비공개 상품일 가능성)")
    
    elapsed_total = time.time() - start_time
    et_m, et_s = divmod(int(elapsed_total), 60)
    et_h, et_m = divmod(et_m, 60)
    time_str = f"{et_h}시간 {et_m}분 {et_s}초" if et_h > 0 else f"{et_m}분 {et_s}초"
    avg_speed = f"{scanned/elapsed_total:.1f}개/초" if elapsed_total > 0 else "N/A"
    save_speed = f"{count/elapsed_total:.1f}개/초" if elapsed_total > 0 else "N/A"
    print(f"\n{'='*50}")
    print(f"  크롤링 완료!")
    print(f"  총 스캔: {scanned:,}개 | 저장: {count:,}개")
    print(f"  총 URL: {len(urls):,}개")
    print(f"  소요 시간: {time_str}")
    print(f"  스캔 속도: {avg_speed} | 저장 속도: {save_speed}")
    print(f"{'='*50}")
    
    cur.close()
    conn.close()


def save_to_csv(products: List[Dict], filename: str = CSV_FILENAME) -> None:
    """크롤링한 상품 데이터를 CSV로 저장합니다."""
    if not products:
        print("저장할 상품이 없습니다.")
        return
    
    fieldnames = ["상품명", "카테고리", "시중가격", "판매가격", "대표이미지", "설명이미지들", "URL", "옵션"]
    
    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for product in products:
            options_str = json.dumps(product.get("옵션", []), ensure_ascii=False) if product.get("옵션") else ""
            
            writer.writerow({
                "상품명": product.get("상품명", ""),
                "카테고리": product.get("카테고리", ""),
                "시중가격": product.get("시중가격", ""),
                "판매가격": product.get("판매가격", ""),
                "대표이미지": product.get("대표이미지", ""),
                "설명이미지들": product.get("설명이미지들", ""),
                "URL": product.get("URL", ""),
                "옵션": options_str,
            })
    
    print(f"[OK] CSV 파일 저장 완료: {filename} ({len(products)}개 상품)")


def crawl_only() -> None:
    """DB 저장 없이 크롤링만 수행하고 CSV로 저장합니다."""
    urls = get_product_urls()
    if not urls:
        print("상품 URL을 찾지 못해 종료합니다.")
        return
    
    print(f"크롤링 시작 (총 {len(urls)}개 후보)...")
    
    products = []
    for idx, url in enumerate(urls, start=1):
        if len(products) >= MAX_SAVE:
            print(f"[STOP] 최대 {MAX_SAVE}개까지만 크롤링 후 중단합니다.")
            break
        
        print(f"[{idx}/{len(urls)}] 수집 중: {url}")
        info = parse_product_detail(url)
        if info:
            products.append(info)
            options = info.get("옵션", [])
            opt_info = f", 옵션 {sum(len(o.get('values', [])) for o in options)}개" if options else ""
            print(f"  [OK] 수집: {info['상품명']}{opt_info}")
        
        time.sleep(random.uniform(1, 3))
    
    save_to_csv(products)
    print(f"완료! 총 {len(products)}개의 상품을 크롤링했습니다.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--csv-only":
        crawl_only()
    else:
        main()
