import csv
import json
import os
import random
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import RealDictCursor

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


def parse_product_detail(url: str) -> Optional[Dict[str, any]]:
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
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    def slugify(text: str) -> str:
        import re

        slug = (
            re.sub(r"[^0-9a-zA-Z\-]+", "-", text.strip().lower())
            .strip("-")
            .replace("--", "-")
        )
        return slug or "etc"

    def ensure_category_single(name: str, slug: str, parent_id: int = None, depth: int = 1) -> int:
        """단일 카테고리를 생성하거나 기존 것을 반환"""
        cur.execute("SELECT id FROM categories WHERE slug=%s", (slug,))
        row = cur.fetchone()
        if row:
            return row["id"]
        cur.execute(
            "INSERT INTO categories (name, slug, parent_id, depth, description) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (name, slug, parent_id, depth, "imported from crawler"),
        )
        return cur.fetchone()["id"]

    def ensure_category_3depth(cat_raw: str) -> int:
        """3뎁스 카테고리를 생성하고 최종(leaf) 카테고리 ID 반환"""
        cat_info = normalize_category_3depth(cat_raw)
        
        parent_id = None
        final_id = None
        
        # depth1 (대분류)
        if cat_info["depth1"]:
            d1 = cat_info["depth1"]
            parent_id = ensure_category_single(d1["name"], d1["slug"], None, 1)
            final_id = parent_id
        
        # depth2 (중분류)
        if cat_info["depth2"]:
            d2 = cat_info["depth2"]
            parent_id = ensure_category_single(d2["name"], d2["slug"], parent_id, 2)
            final_id = parent_id
        
        # depth3 (소분류 - 브랜드 등)
        if cat_info["depth3"]:
            d3 = cat_info["depth3"]
            final_id = ensure_category_single(d3["name"], d3["slug"], parent_id, 3)
        
        return final_id or ensure_category_single("기타", "etc", None, 1)

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

    count = 0
    try:
        for idx, url in enumerate(urls, start=1):
            if count >= MAX_SAVE:
                print(f"[STOP] 최대 {MAX_SAVE}개까지만 저장 후 중단합니다.")
                break
            print(f"[{idx}/{len(urls)}] 수집 중: {url}")
            info = parse_product_detail(url)
            if not info:
                continue

            # 3뎁스 카테고리 생성
            category_id = ensure_category_3depth(info.get("카테고리") or "기타")
            cat_info = normalize_category(info.get("카테고리") or "기타")

            if already_exists(info["상품명"], category_id):
                print(f"  [SKIP] 이미 존재: {info['상품명']} ({cat_info['name']})")
                continue

            # 가격 정제
            def to_price(val: str) -> float:
                digits = "".join([c for c in val if c.isdigit()])
                return float(digits) if digits else 0.0

            # 판매가격 -> price, 시중가격 -> department_price (백화점가)
            price_val = to_price(info.get("판매가격") or "")
            department_price = to_price(info.get("시중가격") or "")
            description = f"{info.get('URL','')}\n{info.get('설명이미지들','')}".strip()
            image_url = info.get("대표이미지") or ""

            cur.execute(
                """
                INSERT INTO products (name, description, price, department_price, category_id, image_url, stock, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, true)
                RETURNING id
                """,
                (
                    info["상품명"],
                    description,
                    price_val,
                    department_price if department_price > 0 else None,
                    category_id,
                    image_url,
                    10,
                ),
            )
            product_id = cur.fetchone()["id"]
            
            # 옵션 저장
            options = info.get("옵션", [])
            option_count = 0
            if options:
                option_count = save_product_options(product_id, options)
            
            count += 1
            sale = info.get("판매가격") or "가격 없음"
            opt_info = f", 옵션 {option_count}개" if option_count else ""
            print(f"  [OK] 저장: {info['상품명']} ({sale}{opt_info})")

            # 서버 부하 방지를 위한 랜덤 대기 (1~3초)
            time.sleep(random.uniform(1, 3))

        conn.commit()
        print(f"완료! 총 {count}개의 상품을 DB에 저장했습니다.")
    except Exception as exc:
        conn.rollback()
        print(f"[ERROR] DB 저장 중 오류: {exc}")
    finally:
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
