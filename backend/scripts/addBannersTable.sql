-- Banners Table
-- type: 'main' (Main Slider), 'category' (Category Section Banner)
CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'main',
  title VARCHAR(200),
  subtitle VARCHAR(200),
  image_url VARCHAR(500) NOT NULL,
  mobile_image_url VARCHAR(500),
  link_url VARCHAR(500),
  category_slug VARCHAR(50),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for better query performance
CREATE INDEX IF NOT EXISTS idx_banners_type ON banners(type);
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_sort ON banners(sort_order);

-- Insert default main slider banners
INSERT INTO banners (type, title, image_url, mobile_image_url, sort_order, is_active) VALUES
('main', 'Main Banner 1', 'https://jpound2024.cafe24.com/images/slider/main/1_2.webp', 'https://jpound2024.cafe24.com/images/slider/main/1_2_m.webp', 1, true),
('main', 'Main Banner 2', 'https://jpound2024.cafe24.com/images/slider/main/7_4.webp', 'https://jpound2024.cafe24.com/images/slider/main/7_4_m.webp', 2, true),
('main', 'Main Banner 3', 'https://jpound2024.cafe24.com/images/slider/main/1_898.jpg', 'https://jpound2024.cafe24.com/images/slider/main/1_898_m.jpg', 3, true),
('main', 'Main Banner 4', 'https://jpound2024.cafe24.com/images/slider/main/1_1.webp', 'https://jpound2024.cafe24.com/images/slider/main/1_88_m.webp', 4, true);

-- Insert default category section banners
INSERT INTO banners (type, title, subtitle, image_url, mobile_image_url, category_slug, link_url, sort_order, is_active) VALUES
('category', 'BEST Bags Collection', 'Best Bag Collection', 'https://jpound2024.cafe24.com/images/slider/main/9_9.webp', 'https://jpound2024.cafe24.com/images/slider/main/9_9_m.webp', 'bag', '/products?category=bag', 1, true),
('category', 'BEST Clothing Collection', 'Best Clothing Collection', 'https://jpound2024.cafe24.com/images/slider/main/2_3.webp', 'https://jpound2024.cafe24.com/images/slider/main/2_3_m.webp', 'clothing', '/products?category=clothing', 2, true),
('category', 'BEST Shoes Collection', 'Best Shoes Collection', 'https://jpound2024.cafe24.com/images/slider/main/5_4.webp', 'https://jpound2024.cafe24.com/images/slider/main/5_5.webp', 'shoes', '/products?category=shoes', 3, true),
('category', 'BEST Watch Collection', 'Best Watch Collection', 'https://jpound2024.cafe24.com/images/slider/main/4_1.webp', 'https://jpound2024.cafe24.com/images/slider/main/4_1.webp', 'watch', '/products?category=watch', 4, true);
