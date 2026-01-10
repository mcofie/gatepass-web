-- Add is_visible column to ticket_tiers table
-- Default to true so existing tiers remain visible

ALTER TABLE gatepass.ticket_tiers 
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN gatepass.ticket_tiers.is_visible IS 'Controls whether this ticket tier is shown on the public event page';
