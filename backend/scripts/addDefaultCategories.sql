-- 기본 카테고리 추가 SQL
-- 실서버에서 실행: sudo -u postgres psql -d modern_shop -f addDefaultCategories.sql

-- parent_slug 컬럼 추가 (없으면)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_slug VARCHAR(255);

-- 기존 카테고리 삭제 (선택사항 - 필요시 주석 해제)
-- DELETE FROM categories;

-- ========== 대분류 (depth 1) ==========
INSERT INTO categories (name, slug, depth, description) VALUES
('남성', 'men', 1, '남성 카테고리'),
('여성', 'women', 1, '여성 카테고리'),
('국내출고상품', 'domestic', 1, '국내출고상품'),
('추천상품', 'recommend', 1, '추천상품'),
('히트상품', 'hot', 1, '히트상품'),
('인기상품', 'popular', 1, '인기상품')
ON CONFLICT (slug) DO NOTHING;

-- ========== 중분류 (depth 2) - 남성 ==========
INSERT INTO categories (name, slug, parent_slug, depth) VALUES
('가방', 'men-bag', 'men', 2),
('지갑', 'men-wallet', 'men', 2),
('시계', 'men-watch', 'men', 2),
('신발', 'men-shoes', 'men', 2),
('벨트', 'men-belt', 'men', 2),
('악세서리', 'men-accessory', 'men', 2),
('모자', 'men-hat', 'men', 2),
('의류', 'men-clothing', 'men', 2),
('선글라스&안경', 'men-glasses', 'men', 2),
('기타', 'men-etc', 'men', 2)
ON CONFLICT (slug) DO NOTHING;

-- ========== 중분류 (depth 2) - 여성 ==========
INSERT INTO categories (name, slug, parent_slug, depth) VALUES
('가방', 'women-bag', 'women', 2),
('지갑', 'women-wallet', 'women', 2),
('시계', 'women-watch', 'women', 2),
('신발', 'women-shoes', 'women', 2),
('벨트', 'women-belt', 'women', 2),
('악세서리', 'women-accessory', 'women', 2),
('모자', 'women-hat', 'women', 2),
('의류', 'women-clothing', 'women', 2),
('선글라스&안경', 'women-glasses', 'women', 2),
('기타', 'women-etc', 'women', 2)
ON CONFLICT (slug) DO NOTHING;

-- ========== 중분류 (depth 2) - 추천상품 ==========
INSERT INTO categories (name, slug, parent_slug, depth) VALUES
('가방', 'recommend-bag', 'recommend', 2),
('지갑', 'recommend-wallet', 'recommend', 2),
('시계', 'recommend-watch', 'recommend', 2),
('신발', 'recommend-shoes', 'recommend', 2),
('벨트', 'recommend-belt', 'recommend', 2),
('악세서리', 'recommend-accessory', 'recommend', 2),
('모자', 'recommend-hat', 'recommend', 2),
('의류', 'recommend-clothing', 'recommend', 2),
('선글라스&안경', 'recommend-glasses', 'recommend', 2),
('기타', 'recommend-etc', 'recommend', 2)
ON CONFLICT (slug) DO NOTHING;

-- ========== 중분류 (depth 2) - 히트상품 ==========
INSERT INTO categories (name, slug, parent_slug, depth) VALUES
('가방', 'hot-bag', 'hot', 2),
('지갑', 'hot-wallet', 'hot', 2),
('시계', 'hot-watch', 'hot', 2),
('신발', 'hot-shoes', 'hot', 2),
('벨트', 'hot-belt', 'hot', 2),
('악세서리', 'hot-accessory', 'hot', 2),
('모자', 'hot-hat', 'hot', 2),
('의류', 'hot-clothing', 'hot', 2),
('선글라스&안경', 'hot-glasses', 'hot', 2),
('기타', 'hot-etc', 'hot', 2)
ON CONFLICT (slug) DO NOTHING;

-- ========== 중분류 (depth 2) - 인기상품 ==========
INSERT INTO categories (name, slug, parent_slug, depth) VALUES
('가방', 'popular-bag', 'popular', 2),
('지갑', 'popular-wallet', 'popular', 2),
('시계', 'popular-watch', 'popular', 2),
('신발', 'popular-shoes', 'popular', 2),
('벨트', 'popular-belt', 'popular', 2),
('악세서리', 'popular-accessory', 'popular', 2),
('모자', 'popular-hat', 'popular', 2),
('의류', 'popular-clothing', 'popular', 2),
('선글라스&안경', 'popular-glasses', 'popular', 2),
('기타', 'popular-etc', 'popular', 2)
ON CONFLICT (slug) DO NOTHING;

-- ========== 중분류 (depth 2) - 국내출고상품 ==========
INSERT INTO categories (name, slug, parent_slug, depth) VALUES
('가방&지갑', 'domestic-bag-wallet', 'domestic', 2),
('의류', 'domestic-clothing', 'domestic', 2),
('신발', 'domestic-shoes', 'domestic', 2),
('모자', 'domestic-hat', 'domestic', 2),
('악세사리', 'domestic-accessory', 'domestic', 2),
('시계', 'domestic-watch', 'domestic', 2),
('패션잡화', 'domestic-fashion-acc', 'domestic', 2),
('생활&주방용품', 'domestic-home-kitchen', 'domestic', 2),
('벨트', 'domestic-belt', 'domestic', 2),
('향수', 'domestic-perfume', 'domestic', 2),
('라이터', 'domestic-lighter', 'domestic', 2)
ON CONFLICT (slug) DO NOTHING;

-- 완료 메시지
SELECT '✅ 기본 카테고리 추가 완료!' as result;
SELECT COUNT(*) as total_categories FROM categories;
