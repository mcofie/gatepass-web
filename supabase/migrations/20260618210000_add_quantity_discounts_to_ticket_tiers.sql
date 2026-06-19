ALTER TABLE gatepass.ticket_tiers ADD COLUMN min_quantity integer DEFAULT NULL;
ALTER TABLE gatepass.ticket_tiers ADD COLUMN discount_value numeric DEFAULT NULL;
ALTER TABLE gatepass.ticket_tiers ADD COLUMN discount_type text DEFAULT NULL CHECK (discount_type IN ('percentage', 'fixed'));
