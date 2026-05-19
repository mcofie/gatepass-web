-- Add tags column to ticket_tiers table
ALTER TABLE "gatepass"."ticket_tiers" 
ADD COLUMN "tags" text[] DEFAULT '{}';

COMMENT ON COLUMN gatepass.ticket_tiers.tags IS 'Custom tags displayed on the ticket card/client';
