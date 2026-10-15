-- Owners can delete their organization. Sales history outlives it: events (and their tickets and
-- orders), payment sessions, platform fee payments and released holds keep their rows with the
-- organization link cleared. Team, integrations, payout setup and activity logs are removed.

-- 1. Historical rows keep existing when their organization is deleted
DO $$
DECLARE
    fk record;
BEGIN
    FOR fk IN
        SELECT c.conrelid::regclass AS tbl, c.conname, a.attname AS col
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f'
          AND c.confrelid = 'gatepass.organizers'::regclass
          AND c.conrelid IN ('gatepass.events'::regclass, 'gatepass.payment_sessions'::regclass,
                             'gatepass.platform_fee_payments'::regclass, 'gatepass.payment_reserves'::regclass)
    LOOP
        EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', fk.tbl, fk.col);
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES gatepass.organizers(id) ON DELETE SET NULL', fk.tbl, fk.conname, fk.col);
    END LOOP;
END $$;

-- 2. What still stands in the way of deleting an organization
CREATE OR REPLACE FUNCTION gatepass.organization_deletion_blockers(p_org uuid)
RETURNS TABLE (upcoming_tickets bigint, held_payouts bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = gatepass, public
AS $$
    SELECT
        (SELECT count(*) FROM gatepass.tickets t
           JOIN gatepass.events e ON e.id = t.event_id
          WHERE e.organization_id = p_org
            AND t.status = 'valid'
            AND coalesce(e.ends_at, e.starts_at + interval '12 hours') > now()),
        (SELECT count(*) FROM gatepass.payment_reserves r
          WHERE r.organizer_id = p_org AND r.status IN ('held', 'releasing', 'on_hold', 'failed'));
$$;
REVOKE ALL ON FUNCTION gatepass.organization_deletion_blockers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gatepass.organization_deletion_blockers(uuid) TO authenticated, service_role;

-- 3. Delete, as the owner, in one transaction
CREATE OR REPLACE FUNCTION gatepass.delete_organization(p_org uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = gatepass, public
AS $$
DECLARE
    b record;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM gatepass.organizers WHERE id = p_org AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Only the organization’s owner can delete it.' USING HINT = 'ORG_NOT_OWNER';
    END IF;

    SELECT * INTO b FROM gatepass.organization_deletion_blockers(p_org);
    IF b.upcoming_tickets > 0 THEN
        RAISE EXCEPTION '% tickets are still valid for upcoming events. Cancel or refund them first.', b.upcoming_tickets
            USING HINT = 'ORG_HAS_UPCOMING_TICKETS';
    END IF;
    IF b.held_payouts > 0 THEN
        RAISE EXCEPTION 'GatePass is still holding money from your sales. It’s released after your events; you can delete the organization then.'
            USING HINT = 'ORG_HAS_HELD_PAYOUTS';
    END IF;

    -- Take everything off sale; the rows stay for ticket holders and records
    UPDATE gatepass.events SET is_published = false, sales_enabled = false WHERE organization_id = p_org;
    DELETE FROM gatepass.organizers WHERE id = p_org;
END;
$$;
REVOKE ALL ON FUNCTION gatepass.delete_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gatepass.delete_organization(uuid) TO authenticated;
