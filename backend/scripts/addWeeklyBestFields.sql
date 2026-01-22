-- Weekly Best 상품 관리를 위한 테이블 생성
-- 대분류별로 Weekly Best 상품을 관리

-- weekly_best_products 테이블 생성
CREATE TABLE IF NOT EXISTS weekly_best_products (
    id SERIAL PRIMARY KEY,
    category_slug VARCHAR(255) NOT NULL,  -- 대분류 슬러그 (men, women, domestic 등)
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_slug, product_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_weekly_best_category ON weekly_best_products(category_slug);
CREATE INDEX IF NOT EXISTS idx_weekly_best_order ON weekly_best_products(category_slug, display_order);

-- 테이블 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'weekly_best_products';
