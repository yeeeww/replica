import csv
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
MAX_SAVE = int(os.environ.get("CRAWL_LIMIT", "20"))


def normalize_category(cat_raw: str) -> Dict[str, str]:
    """
    '남성 > 지갑 > 프라다' 형태를 슬러그/이름으로 변환
    프런트 정의된 카테고리 슬러그와 맞추기.
    """
    parts = [p.strip() for p in cat_raw.split(">") if p.strip()]
    main = parts[0] if parts else "기타"
    sub = parts[1] if len(parts) > 1 else ""

    def slugify(txt: str) -> str:
        import re
        slug = (
            re.sub(r"[^0-9a-zA-Z\-]+", "-", txt.strip().lower())
            .strip("-")
            .replace("--", "-")
        )
        return slug or "etc"

    # main slug mapping
    main_map = {
        "남성": "men",
        "여성": "women",
        "국내출고상품": "domestic",
        "국내출고 상품": "domestic",
        "국내출고": "domestic",
        "국내 출고": "domestic",
        "가방": "bags",
        "의류": "clothing",
        "신발": "shoes",
        "acc": "acc",
        "악세서리": "acc",
        "액세서리": "acc",
    }

    # pair mapping for men/women sub
    pair_map = {
        ("남성", "가방"): "men-bag",
        ("남성", "지갑"): "men-wallet",
        ("남성", "시계"): "men-watch",
        ("남성", "신발"): "men-shoes",
        ("남성", "벨트"): "men-belt",
        ("남성", "악세서리"): "men-accessory",
        ("남성", "액세서리"): "men-accessory",
        ("남성", "모자"): "men-hat",
        ("남성", "의류"): "men-clothing",
        ("남성", "선글라스&안경"): "men-glasses",
        ("남성", "선글라스"): "men-glasses",
        ("남성", "안경"): "men-glasses",
        ("남성", "기타"): "men-etc",
        ("여성", "가방"): "women-bag",
        ("여성", "지갑"): "women-wallet",
        ("여성", "시계"): "women-watch",
        ("여성", "신발"): "women-shoes",
        ("여성", "벨트"): "women-belt",
        ("여성", "악세서리"): "women-accessory",
        ("여성", "액세서리"): "women-accessory",
        ("여성", "모자"): "women-hat",
        ("여성", "의류"): "women-clothing",
        ("여성", "선글라스&안경"): "women-glasses",
        ("여성", "선글라스"): "women-glasses",
        ("여성", "안경"): "women-glasses",
        ("여성", "기타"): "women-etc",
    }

    # domestic mapping
    def domestic_sub_to_slug(subtxt: str) -> str:
        if "가방" in subtxt or "지갑" in subtxt:
            return "domestic-bag-wallet"
        if "의류" in subtxt or "옷" in subtxt:
            return "domestic-clothing"
        if "신발" in subtxt:
            return "domestic-shoes"
        if "모자" in subtxt:
            return "domestic-hat"
        if "악세" in subtxt or "액세" in subtxt:
            return "domestic-accessory"
        if "시계" in subtxt:
            return "domestic-watch"
        if "패션잡화" in subtxt:
            return "domestic-fashion-acc"
        if "생활" in subtxt or "주방" in subtxt:
            return "domestic-home-kitchen"
        if "벨트" in subtxt:
            return "domestic-belt"
        if "향수" in subtxt:
            return "domestic-perfume"
        if "라이터" in subtxt:
            return "domestic-lighter"
        return "domestic-etc"

    # choose slug
    if (main, sub) in pair_map:
        cat_slug = pair_map[(main, sub)]
        cat_name = f"{main} > {sub}"
    elif main in ["남성", "여성"] and sub:
        cat_slug = f"{main_map.get(main, slugify(main))}-{slugify(sub)}"
        cat_name = f"{main} > {sub}"
    elif main.startswith("국내"):
        cat_slug = domestic_sub_to_slug(sub or "")
        cat_name = f"국내출고 {sub or '기타'}".strip()
    else:
        main_slug = main_map.get(main, slugify(main))
        sub_slug = slugify(sub) if sub else main_slug
        cat_slug = sub_slug if sub else main_slug
        cat_name = f"{main} {sub}".strip() or "기타"

    return {"name": cat_name, "slug": cat_slug}


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


def parse_product_detail(url: str) -> Optional[Dict[str, str]]:
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

        return {
            "상품명": title,
            "카테고리": category,
            "시중가격": market_price,
            "판매가격": sale_price,
            "대표이미지": img_url,
            "설명이미지들": ";".join(desc_img_urls),
            "URL": url,
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
        print("❌ DB_PASSWORD 환경변수가 비어있습니다. .env 또는 환경변수를 설정하세요.")
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

    def ensure_category(name: str, slug: str) -> int:
        cur.execute("SELECT id FROM categories WHERE slug=%s", (slug,))
        row = cur.fetchone()
        if row:
            return row["id"]
        cur.execute(
            "INSERT INTO categories (name, slug, description) VALUES (%s, %s, %s) RETURNING id",
            (name, slug, "imported from crawler"),
        )
        return cur.fetchone()["id"]

    def already_exists(name: str, category_id: int) -> bool:
        cur.execute(
            "SELECT id FROM products WHERE name=%s AND category_id=%s",
            (name, category_id),
        )
        return cur.fetchone() is not None

    count = 0
    try:
        for idx, url in enumerate(urls, start=1):
            if count >= MAX_SAVE:
                print(f"⏹️  최대 {MAX_SAVE}개까지만 저장 후 중단합니다.")
                break
            print(f"[{idx}/{len(urls)}] 수집 중: {url}")
            info = parse_product_detail(url)
            if not info:
                continue

            cat_info = normalize_category(info.get("카테고리") or "기타")
            category_id = ensure_category(cat_info["name"], cat_info["slug"])

            if already_exists(info["상품명"], category_id):
                print(f"  ↩️  이미 존재: {info['상품명']} ({cat_info['name']})")
                continue

            # 가격 정제
            def to_price(val: str) -> float:
                digits = "".join([c for c in val if c.isdigit()])
                return float(digits) if digits else 0.0

            price_val = to_price(info.get("판매가격") or info.get("시중가격") or "")
            description = f"{info.get('URL','')}\n{info.get('설명이미지들','')}".strip()
            image_url = info.get("대표이미지") or ""

            cur.execute(
                """
                INSERT INTO products (name, description, price, category_id, image_url, stock, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, true)
                """,
                (
                    info["상품명"],
                    description,
                    price_val,
                    category_id,
                    image_url,
                    10,
                ),
            )
            count += 1
            sale = info.get("판매가격") or "가격 없음"
            print(f"  ✅ 저장: {info['상품명']} ({sale})")

            # 서버 부하 방지를 위한 랜덤 대기 (1~3초)
            time.sleep(random.uniform(1, 3))

        conn.commit()
        print(f"완료! 총 {count}개의 상품을 DB에 저장했습니다.")
    except Exception as exc:
        conn.rollback()
        print(f"❌ DB 저장 중 오류: {exc}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()


