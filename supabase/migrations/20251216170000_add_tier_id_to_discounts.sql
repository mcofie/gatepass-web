-- Add tier_id to discounts table for tier-specific promotions
ALTER TABLE gatepass.discounts 
ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES gatepass.ticket_tiers(id) ON DELETE CASCADE;

-- No need for new RLS policies as existing one covers "ALL" for organizers
