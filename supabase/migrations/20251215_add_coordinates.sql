-- Add coordinates to events table
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
