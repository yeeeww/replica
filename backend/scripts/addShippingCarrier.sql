-- Add shipping_carrier column to orders table
-- Run: psql -U postgres -d modern_shop -f addShippingCarrier.sql

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(100);

-- Verify
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders';
