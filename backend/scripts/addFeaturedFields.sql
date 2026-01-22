-- Add featured product fields to products table
-- Run: psql -U postgres -d modern_shop -f addFeaturedFields.sql

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hot BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_recommended ON products(is_recommended) WHERE is_recommended = true;
CREATE INDEX IF NOT EXISTS idx_products_hot ON products(is_hot) WHERE is_hot = true;
CREATE INDEX IF NOT EXISTS idx_products_popular ON products(is_popular) WHERE is_popular = true;

-- Verify
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position;
