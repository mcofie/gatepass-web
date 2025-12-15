-- Add video_url to events table
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS video_url TEXT;
