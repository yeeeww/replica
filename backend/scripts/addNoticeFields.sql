-- Add attachments field to notices table
-- Run: psql -U postgres -d modern_shop -f addNoticeFields.sql

ALTER TABLE notices ADD COLUMN IF NOT EXISTS attachments TEXT;

-- Verify
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notices' ORDER BY ordinal_position;
