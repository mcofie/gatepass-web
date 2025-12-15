-- Add perks column to ticket_tiers table
ALTER TABLE "gatepass"."ticket_tiers" 
ADD COLUMN "perks" text[] DEFAULT '{}';
