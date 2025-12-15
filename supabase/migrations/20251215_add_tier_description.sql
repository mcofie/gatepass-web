-- Add description to ticket_tiers
ALTER TABLE gatepass.ticket_tiers 
ADD COLUMN IF NOT EXISTS description TEXT;
