-- Add social media links to events table
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS social_website TEXT;
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS social_instagram TEXT;
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS social_twitter TEXT;
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS social_facebook TEXT;
