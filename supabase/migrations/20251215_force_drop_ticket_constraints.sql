-- Aggressively drop ALL UNIQUE constraints on gatepass.tickets
-- This is necessary to allow multiple tickets per reservation/order.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'gatepass' 
        AND table_name = 'tickets' 
        AND constraint_type = 'UNIQUE'
    LOOP
        RAISE NOTICE 'Dropping unique constraint: %', r.constraint_name;
        EXECUTE 'ALTER TABLE gatepass.tickets DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;
