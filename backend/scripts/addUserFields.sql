-- Add additional user fields for registration
-- Run this script to add new columns to the users table

-- Add gender column
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

-- Add address column
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

-- Add birth_date column
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Add referral_source column (how user found the site)
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_source VARCHAR(50);

-- Add customs_number column (personal customs clearance code)
ALTER TABLE users ADD COLUMN IF NOT EXISTS customs_number VARCHAR(50);

-- Add referrer column (who referred the user)
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer VARCHAR(100);

-- Add profile_image column
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);
