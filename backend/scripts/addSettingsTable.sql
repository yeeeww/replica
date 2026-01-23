-- Points settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO site_settings (setting_key, setting_value, description) VALUES
  ('register_points', '5000', 'Points for new registration'),
  ('purchase_points_rate', '1', 'Purchase points rate (%)'),
  ('points_name', 'Points', 'Points display name')
ON CONFLICT (setting_key) DO NOTHING;

-- Add points columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS used_points INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS earned_points INTEGER DEFAULT 0;
