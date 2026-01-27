import csv
import json
import os
import random
import time
import io
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import RealDictCursor

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
        response = requests.get(image_url, headers=HEADERS, timeout=30)
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
    여러 이미지를 병렬로 S3에 업로드
    Returns: S3 URL 리스트
    """
    if not s3_client or not image_urls:
        return image_urls
    
    s3_urls = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(upload_image_to_s3, url, prefix): url for url in image_urls}
        for future in as_completed(futures):
            try:
                s3_url = future.result()
                s3_urls.append(s3_url)
            except Exception as e:
                original_url = futures[future]
                print(f"[S3 ERROR] 배치 업로드 실패: {e}")
                s3_urls.append(original_url)
    
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
CSV_FILENAME = "replmoa_products.csv"
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", "5432")),
    "dbname": os.environ.get("DB_NAME", "modern_shop"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "1234"),
}
MAX_SAVE = int(os.environ.get("CRAWL_LIMIT", "50"))
CATEGORY_FILTER = os.environ.get("CRAWL_CATEGORY", "")  # 예: "남성", "여성", "남성 > 지갑" 등
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


def normalize_category_3depth(cat_raw: str) -> Dict[str, any]:
    """
    '남성 > 지갑 > 프라다' 형태를 3뎁스 카테고리 정보로 변환
    Returns: {
        "depth1": {"name": "남성", "slug": "men"},
        "depth2": {"name": "지갑", "slug": "men-wallet"},
        "depth3": {"name": "프라다", "slug": "men-wallet-prada"},
        "full_name": "남성 > 지갑 > 프라다"
    }
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
    
    # 중분류 매핑 (대분류별)
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
    
    result = {
        "depth1": None,
        "depth2": None,
        "depth3": None,
        "full_name": cat_raw,
        "leaf_slug": None,  # 최종 카테고리 슬러그 (상품에 연결될 것)
    }
    
    # 대분류 (depth1)
    if parts:
        main_name = parts[0]
        main_slug = main_map.get(main_name, slugify(main_name))
        result["depth1"] = {"name": main_name, "slug": main_slug}
        result["leaf_slug"] = main_slug
    
    # 중분류 (depth2)
    if len(parts) > 1:
        sub_name = parts[1]
        sub_slug_base = sub_map.get(sub_name, slugify(sub_name))
        sub_slug = f"{result['depth1']['slug']}-{sub_slug_base}"
        result["depth2"] = {"name": sub_name, "slug": sub_slug, "parent_slug": result["depth1"]["slug"]}
        result["leaf_slug"] = sub_slug
    
    # 소분류 (depth3) - 브랜드 등
    if len(parts) > 2:
        brand_name = parts[2]
        brand_slug = f"{result['depth2']['slug']}-{slugify(brand_name)}"
        result["depth3"] = {"name": brand_name, "slug": brand_slug, "parent_slug": result["depth2"]["slug"]}
        result["leaf_slug"] = brand_slug
    
    return result


def normalize_category(cat_raw: str) -> Dict[str, str]:
    """
    기존 호환용 - 최종 카테고리 정보만 반환
    """
    cat_info = normalize_category_3depth(cat_raw)
    
    # 가장 깊은 카테고리 이름 결정
    if cat_info["depth3"]:
        name = f"{cat_info['depth1']['name']} > {cat_info['depth2']['name']} > {cat_info['depth3']['name']}"
    elif cat_info["depth2"]:
        name = f"{cat_info['depth1']['name']} > {cat_info['depth2']['name']}"
    elif cat_info["depth1"]:
        name = cat_info["depth1"]["name"]
    else:
        name = "기타"
    
    return {"name": name, "slug": cat_info["leaf_slug"] or "etc"}


def get_product_urls() -> List[str]:
    """사이트맵에서 상품 상세 페이지 URL을 추출합니다."""
    print(f"사이트맵 불러오는 중: {SITEMAP_URL}")
    try:
        response = requests.get(SITEMAP_URL, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "xml")

        urls: List[str] = []
        for loc in soup.find_all("loc"):
            url = loc.text
            # 영카트/그누보드 기반 쇼핑몰의 상품 URL 패턴: item.php
            if "item.php" in url:
                urls.append(url)

        print(f"총 {len(urls)}개의 상품 URL을 찾았습니다.")
        return urls
    except Exception as exc:
        print(f"사이트맵 로드 실패: {exc}")
        return []


def parse_product_options(soup: BeautifulSoup) -> List[Dict[str, any]]:
    """상품 옵션(사이즈, 컬러 등)을 추출합니다."""
    options = []
    
    # 그누보드/영카트 기반 쇼핑몰의 옵션 select 추출
    # 일반적으로 sit_opt_added 또는 sit_option 영역에 select가 있음
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
            # 옵션명 추출 (label 또는 이전 텍스트)
            label = select_tag.find_previous("label")
            if label:
                option_name = label.get_text(strip=True)
            else:
                # select 이전의 텍스트 노드에서 옵션명 찾기
                prev = select_tag.find_previous(string=True)
                if prev:
                    option_name = prev.strip().rstrip(":")
            
            # select name 또는 id에서 옵션명 추출 시도
            if not option_name:
                name_attr = select_tag.get("name", "") or select_tag.get("id", "")
                if "color" in name_attr.lower() or "컬러" in name_attr:
                    option_name = "컬러"
                elif "size" in name_attr.lower() or "사이즈" in name_attr:
                    option_name = "사이즈"
                else:
                    option_name = "옵션"
            
            # 옵션 값들 추출
            option_values = []
            for opt in select_tag.find_all("option"):
                val = opt.get_text(strip=True)
                # '선택' 같은 기본값은 제외
                if val and "선택" not in val and val != "-":
                    import re
                    # 추가금액 정보도 파싱
                    price_add = 0
                    if "(" in val and "원" in val:
                        price_match = re.search(r"\(([+-]?\s*[\d,]+)\s*원\)", val)
                        if price_match:
                            price_str = price_match.group(1).replace(",", "").replace(" ", "")
                            try:
                                price_add = int(price_str)
                            except:
                                pass
                        # 값에서 가격 부분 제거
                        val = re.sub(r"\([+-]?\s*[\d,]+\s*원\)", "", val).strip()
                    
                    # "+ 0원", "- 0원" 등 추가 패턴도 제거
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
    
    # 중복 옵션 제거
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
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.text, "html.parser")

        # 1. 상품명 추출
        title_tag = soup.select_one("#sit_title") or soup.select_one(".stitle")
        title = title_tag.text.strip() if title_tag else "상품명 없음"

        # 2. 카테고리 추출 (sit_ov 영역의 카테고리 노출 텍스트 사용)
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
                img_url = "https://replmoa1.com" + img_url  # 상대경로 처리

        # 5. 상세 설명 내 이미지들 추출 (여러 개를 ';'로 구분)
        #    특정 이미지(불필요한 마지막 이미지) 제거 대상 목록을 미리 정의
        exclude_images = {
            "https://replmoa1.com/data/editor/2409/f43f6efd43e8ac62b2810d06535ee845_1727412960_5405.jpg"
        }
        desc_img_urls: List[str] = []
        desc_selectors = [
            "#sit_inf img",
            ".sit_inf img",
            "#sit_inf_explan img",
            "#sit_desc img",
            ".sit_desc img",
            ".item_explan img",
            ".product-detail img",
        ]
        seen = set()
        for selector in desc_selectors:
            for tag in soup.select(selector):
                src = tag.get("src") or ""
                if not src:
                    continue
                abs_src = urljoin("https://replmoa1.com", src)
                if abs_src in exclude_images:
                    continue
                if abs_src not in seen:
                    seen.add(abs_src)
                    desc_img_urls.append(abs_src)

        # 6. 옵션(사이즈, 컬러 등) 추출
        options = parse_product_options(soup)

        # 7. S3에 이미지 업로드 (활성화된 경우)
        if upload_to_s3 and s3_client:
            # 대표 이미지 S3 업로드
            if img_url:
                s3_img_url = upload_image_to_s3(img_url, prefix="products")
                if s3_img_url and s3_img_url != img_url:
                    print(f"  [S3] 대표이미지 업로드 완료")
                    img_url = s3_img_url
            
            # 설명 이미지들 S3 업로드 (병렬 처리)
            if desc_img_urls:
                print(f"  [S3] 설명이미지 {len(desc_img_urls)}개 업로드 중...")
                s3_desc_urls = upload_images_batch_to_s3(desc_img_urls, prefix="products/desc")
                desc_img_urls = s3_desc_urls
                print(f"  [S3] 설명이미지 업로드 완료")

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
    # 1. URL 수집
    urls = get_product_urls()

    if not urls:
        print("상품 URL을 찾지 못해 종료합니다.")
        return

    print(f"크롤링 시작 (총 {len(urls)}개 후보)...")

    # 2. DB 연결
    if not DB_CONFIG["password"]:
        print("[ERROR] DB_PASSWORD 환경변수가 비어있습니다. .env 또는 환경변수를 설정하세요.")
        return

    conn = psycopg2.connect(**DB_CONFIG)
    # 크롤링 중간 종료/에러 시 이미 저장된 건을 유지하기 위해 자동 커밋 활성화
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
        """단일 카테고리를 생성하거나 기존 것을 반환"""
        cur.execute("SELECT id FROM categories WHERE slug=%s", (slug,))
        row = cur.fetchone()
        if row:
            # 기존 카테고리의 parent_slug가 비어있으면 업데이트
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

    def ensure_category_3depth(cat_raw: str) -> int:
        """3뎁스 카테고리를 생성하고 최종(leaf) 카테고리 ID 반환"""
        cat_info = normalize_category_3depth(cat_raw)
        
        parent_id = None
        parent_slug = None
        final_id = None
        
        # depth1 (대분류)
        if cat_info["depth1"]:
            d1 = cat_info["depth1"]
            parent_id = ensure_category_single(d1["name"], d1["slug"], None, None, 1)
            parent_slug = d1["slug"]
            final_id = parent_id
        
        # depth2 (중분류)
        if cat_info["depth2"]:
            d2 = cat_info["depth2"]
            parent_id = ensure_category_single(d2["name"], d2["slug"], parent_id, parent_slug, 2)
            parent_slug = d2["slug"]
            final_id = parent_id
        
        # depth3 (소분류 - 브랜드 등)
        if cat_info["depth3"]:
            d3 = cat_info["depth3"]
            final_id = ensure_category_single(d3["name"], d3["slug"], parent_id, parent_slug, 3)
        
        return final_id or ensure_category_single("기타", "etc", None, None, 1)

    def ensure_category(name: str, slug: str) -> int:
        """기존 호환용"""
        return ensure_category_single(name, slug, None, 1)

    def already_exists(name: str, category_id: int) -> bool:
        cur.execute(
            "SELECT id FROM products WHERE name=%s AND category_id=%s",
            (name, category_id),
        )
        return cur.fetchone() is not None

    def save_product_options(product_id: int, options: List[Dict]) -> int:
        """상품 옵션을 DB에 저장합니다."""
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

    # 카테고리 필터 함수
    def matches_category_filter(product_category: str) -> bool:
        """상품 카테고리가 필터 조건에 맞는지 확인"""
        if not CATEGORY_FILTER:
            return True  # 필터 없으면 모든 카테고리 허용
        
        product_cat_lower = product_category.lower().strip()
        filter_lower = CATEGORY_FILTER.lower().strip()
        
        # 정확히 일치하거나 시작하면 통과
        if product_cat_lower.startswith(filter_lower):
            return True
        
        # 부분 문자열 포함 체크 (예: "남성"이 "남성 > 지갑 > 프라다"에 포함)
        filter_parts = [p.strip() for p in filter_lower.split(">")]
        product_parts = [p.strip() for p in product_cat_lower.split(">")]
        
        # 필터의 모든 파트가 순서대로 상품 카테고리에 있는지 확인
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

    # 가격 정제 함수
    def to_price(val: str) -> float:
        digits = "".join([c for c in val if c.isdigit()])
        return float(digits) if digits else 0.0

    # 병렬 크롤링으로 카테고리 필터링된 상품만 수집
    def fetch_and_filter(url_idx_tuple):
        """URL에서 상품 정보 가져오고 카테고리 필터 적용"""
        idx, url = url_idx_tuple
        try:
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
    
    # DB 저장 함수 (메모리 절약을 위해 즉시 저장)
    def save_product_to_db(info):
        nonlocal count
        
        product_category = info.get("카테고리") or "기타"
        category_id = ensure_category_3depth(product_category)

        if already_exists(info["상품명"], category_id):
            print(f"  [SKIP] 이미 존재: {info['상품명']}")
            return False

        price_val = to_price(info.get("판매가격") or "")
        department_price = to_price(info.get("시중가격") or "")
        # DB 제한에 맞춰 상한 적용
        if price_val and price_val > MAX_DB_PRICE:
            print(f"[WARN] 가격 상한 적용: {price_val} -> {MAX_DB_PRICE} ({info.get('상품명')})")
            price_val = MAX_DB_PRICE
        if department_price and department_price > MAX_DB_PRICE:
            print(f"[WARN] 백화점가 상한 적용: {department_price} -> {MAX_DB_PRICE} ({info.get('상품명')})")
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
            print(f"[ERROR] DB 저장 중 오류(건너뜀): {exc} / {info['상품명']}")
            return False
        
        options = info.get("옵션", [])
        option_count = save_product_options(product_id, options) if options else 0
        
        count += 1
        sale = info.get("판매가격") or "가격 없음"
        opt_info = f", 옵션 {option_count}개" if option_count else ""
        print(f"  [OK] 저장 ({count}/{MAX_SAVE}): {info['상품명']} ({sale}{opt_info})")
        return True
    
    # 필터가 있으면 병렬로 빠르게 스캔 + 즉시 저장 (메모리 절약)
    if CATEGORY_FILTER:
        print(f"[SCAN] 카테고리 '{CATEGORY_FILTER}' 상품을 병렬 스캔 중...")
        
        # 배치 크기 조절 (메모리 관리)
        batch_size = 30  # 한 번에 30개씩 병렬 처리
        url_batches = [urls[i:i+batch_size] for i in range(0, len(urls), batch_size)]
        
        for batch_idx, batch in enumerate(url_batches):
            if count >= MAX_SAVE:
                break
                
            with ThreadPoolExecutor(max_workers=8) as executor:
                futures = {
                    executor.submit(fetch_and_filter, (scanned + i + 1, url)): url 
                    for i, url in enumerate(batch)
                }
                
                for future in as_completed(futures):
                    info, idx, url, error = future.result()
                    scanned += 1
                    
                    if info:
                        print(f"[{idx}/{len(urls)}] [MATCH] {info.get('카테고리', '')} - {info.get('상품명', '')[:30]}")
                        # 즉시 DB에 저장 (메모리에 쌓지 않음)
                        save_product_to_db(info)
                        if count >= MAX_SAVE:
                            break
                    else:
                        # 스캔 진행률 (500개마다 표시)
                        if scanned % 500 == 0:
                            print(f"[SCAN] {scanned}개 스캔, {count}개 저장됨...")
            
            # 배치 간 메모리 정리 및 짧은 대기
            if batch_idx % 10 == 0:
                gc.collect()
            time.sleep(0.3)
        
        print(f"[SCAN] 완료: {scanned}개 스캔, {count}개 저장됨")
    
    else:
        # 필터 없으면 순차 처리 - 4만개 대용량 크롤링에 최적화
        try:
            for idx, url in enumerate(urls, start=1):
                if count >= MAX_SAVE:
                    print(f"[STOP] 최대 {MAX_SAVE}개까지만 저장 후 중단합니다.")
                    break
                print(f"[{idx}/{len(urls)}] 수집 중: {url}")
                info = parse_product_detail(url)
                if not info:
                    continue

                # 즉시 DB에 저장 (save_product_to_db 함수 재사용)
                save_product_to_db(info)
                
                # 메모리 정리 (1000개마다)
                if idx % 1000 == 0:
                    gc.collect()
                    print(f"[MEM] {idx}개 처리, 메모리 정리 완료")

                time.sleep(random.uniform(0.3, 0.8))
        except Exception as exc:
            print(f"[ERROR] 크롤링 중 오류: {exc}")

    # autocommit이므로 별도 commit 불필요, 완료 메시지만 출력
    print(f"완료! 총 {count}개의 상품을 DB에 저장했습니다.")
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
            # 옵션을 JSON 문자열로 변환
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
