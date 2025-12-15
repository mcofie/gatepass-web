-- Remove unique constraints that prevent multiple tickets per reservation/order
ALTER TABLE gatepass.tickets DROP CONSTRAINT IF EXISTS tickets_reservation_id_key;
ALTER TABLE gatepass.tickets DROP CONSTRAINT IF EXISTS tickets_order_reference_key;

-- If they were created with custom names, we might miss them, but these are defaults.
-- We can also try dropping indexes if they exist as unique
DROP INDEX IF EXISTS gatepass.tickets_reservation_id_key;
DROP INDEX IF EXISTS gatepass.tickets_order_reference_key;
