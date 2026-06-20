-- Add virtual ticket fields to ticket_tiers
ALTER TABLE gatepass.ticket_tiers ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT FALSE;
ALTER TABLE gatepass.ticket_tiers ADD COLUMN IF NOT EXISTS virtual_link TEXT DEFAULT NULL;
ALTER TABLE gatepass.ticket_tiers ADD COLUMN IF NOT EXISTS virtual_instructions TEXT DEFAULT NULL;

COMMENT ON COLUMN gatepass.ticket_tiers.is_virtual IS 'Identifies if the ticket tier is for virtual or remote access';
COMMENT ON COLUMN gatepass.ticket_tiers.virtual_link IS 'URL for accessing the remote stream/livestream';
COMMENT ON COLUMN gatepass.ticket_tiers.virtual_instructions IS 'Access codes, schedules, or instructions for the virtual stream';
