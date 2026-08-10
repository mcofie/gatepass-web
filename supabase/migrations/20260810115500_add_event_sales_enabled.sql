-- Add sales_enabled column to events table
ALTER TABLE gatepass.events 
ADD COLUMN IF NOT EXISTS sales_enabled BOOLEAN NOT NULL DEFAULT true;

-- Drop NOT NULL constraint on tier_id in waitlist table
ALTER TABLE gatepass.waitlist 
ALTER COLUMN tier_id DROP NOT NULL;
