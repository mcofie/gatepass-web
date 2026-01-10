-- Add publish_at column to events table for scheduled publishing

ALTER TABLE gatepass.events 
ADD COLUMN IF NOT EXISTS publish_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN gatepass.events.publish_at IS 'Scheduled time to automatically publish the event. NULL means manual publish.';

-- Create index for efficient scheduled publish queries
CREATE INDEX IF NOT EXISTS idx_events_publish_at ON gatepass.events (publish_at) WHERE publish_at IS NOT NULL AND is_published = false;
