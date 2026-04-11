-- Add image_url column to words table
ALTER TABLE words ADD COLUMN IF NOT EXISTS image_url TEXT;
