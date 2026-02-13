-- Add Meta Pixel and Google Analytics support to organizers
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT;
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT;

-- Update RLS or permissions if needed (usually covered by existing owner policies)
