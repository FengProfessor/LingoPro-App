-- Add Gemini API key column for BYOK (Bring Your Own Key) support
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- Update RLS policies to ensure users can only see/edit their own keys
-- (Assuming standard RLS is already in place for profiles)
