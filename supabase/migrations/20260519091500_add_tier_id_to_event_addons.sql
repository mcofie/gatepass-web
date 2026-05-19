-- Add tier_id to event_addons to allow tying an addon to a specific ticket tier
ALTER TABLE "gatepass"."event_addons" 
ADD COLUMN "tier_id" UUID REFERENCES gatepass.ticket_tiers(id) ON DELETE CASCADE;

COMMENT ON COLUMN gatepass.event_addons.tier_id IS 'Ties this addon to a specific ticket tier. If null, the addon is available for all tiers.';
