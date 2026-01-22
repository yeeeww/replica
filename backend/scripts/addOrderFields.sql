-- Add additional fields to orders table
-- Run: psql -U postgres -d modern_shop -f addOrderFields.sql

ALTER TABLE orders ADD COLUMN IF NOT EXISTS orderer_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS orderer_phone VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS orderer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customs_id VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_memo TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS depositor_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_memo TEXT;

-- Verify
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position;
