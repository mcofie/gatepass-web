-- GatePass Payments: organizers without their own payment keys sell through GatePass's Paystack
-- account. Each sale is split at checkout: GatePass's per-ticket fee, a reserve held for new
-- organizers, and the rest settled straight to the organizer's Paystack subaccount.

-- 1. Where an organizer is paid
CREATE TABLE IF NOT EXISTS gatepass.organizer_payout_accounts (
    organizer_id uuid PRIMARY KEY REFERENCES gatepass.organizers(id) ON DELETE CASCADE,
    country text NOT NULL,
    currency text NOT NULL,
    account_type text NOT NULL CHECK (account_type IN ('bank', 'mobile_money')),
    bank_code text NOT NULL,
    bank_name text NOT NULL,
    account_number text NOT NULL,
    account_name text NOT NULL,
    paystack_subaccount_code text NOT NULL,
    paystack_recipient_code text,
    -- New organizers have part of each sale held until after their event
    trust_level text NOT NULL DEFAULT 'new' CHECK (trust_level IN ('new', 'trusted')),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE gatepass.organizer_payout_accounts ENABLE ROW LEVEL SECURITY;

-- Owners and team members can see their own payout account; only the server writes
DROP POLICY IF EXISTS "Organization members view payout account" ON gatepass.organizer_payout_accounts;
CREATE POLICY "Organization members view payout account" ON gatepass.organizer_payout_accounts
    FOR SELECT TO authenticated USING (gatepass.is_organization_member(organizer_id));

-- 2. Amounts held back from sales, released after the event
CREATE TABLE IF NOT EXISTS gatepass.payment_reserves (
    reference text PRIMARY KEY,
    organizer_id uuid NOT NULL REFERENCES gatepass.organizers(id) ON DELETE CASCADE,
    event_id uuid REFERENCES gatepass.events(id) ON DELETE SET NULL,
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    fee_minor bigint NOT NULL DEFAULT 0,
    currency text NOT NULL,
    status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'releasing', 'released', 'failed', 'on_hold')),
    release_after timestamptz NOT NULL,
    transfer_code text,
    failure_reason text,
    released_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_reserves_due_idx ON gatepass.payment_reserves (status, release_after);
CREATE INDEX IF NOT EXISTS payment_reserves_organizer_idx ON gatepass.payment_reserves (organizer_id);
ALTER TABLE gatepass.payment_reserves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members view reserves" ON gatepass.payment_reserves;
CREATE POLICY "Organization members view reserves" ON gatepass.payment_reserves
    FOR SELECT TO authenticated USING (gatepass.is_organization_member(organizer_id));

-- 3. Terms (editable by platform admins)
INSERT INTO gatepass.settings (key, value)
VALUES ('managed_payments', '{"fee_percent": 5, "reserve_percent": 25, "release_hours": 48}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Events on GatePass Payments pay per ticket, so they skip the one-time platform fee
CREATE OR REPLACE FUNCTION gatepass.event_uses_managed_payments(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = gatepass, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM gatepass.events e
        JOIN gatepass.organizer_integrations i
          ON i.organizer_id = e.organization_id AND i.category = 'payments' AND i.provider = 'gatepass' AND i.status = 'connected'
        WHERE e.id = p_event_id
          AND (i.id = e.payment_integration_id OR (e.payment_integration_id IS NULL AND i.is_default))
    );
$$;
REVOKE ALL ON FUNCTION gatepass.event_uses_managed_payments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gatepass.event_uses_managed_payments(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION gatepass.enforce_event_publish_requirements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = gatepass, public
AS $$
DECLARE
    q record;
BEGIN
    IF NOT NEW.is_published OR (TG_OP = 'UPDATE' AND OLD.is_published) THEN
        RETURN NEW;
    END IF;
    IF gatepass.check_is_super_admin() THEN
        RETURN NEW;
    END IF;

    IF NOT gatepass.event_uses_managed_payments(NEW.id) THEN
        SELECT * INTO q FROM gatepass.event_platform_fee_quote(NEW.id);
        IF q.tier_id IS NULL THEN
            RAISE EXCEPTION 'No GatePass plan covers % tickets. Please contact support.', q.ticket_capacity
                USING HINT = 'PLATFORM_FEE_NO_TIER';
        END IF;
        IF NOT q.covered THEN
            RAISE EXCEPTION 'Pay the GatePass platform fee before publishing this event.'
                USING HINT = 'PLATFORM_FEE_UNPAID';
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM gatepass.ticket_tiers WHERE event_id = NEW.id AND price > 0)
       AND NOT gatepass.event_has_payment_provider(NEW.id) THEN
        RAISE EXCEPTION 'Connect and verify a payment provider before publishing an event with paid tickets.'
            USING HINT = 'PAYMENT_PROVIDER_REQUIRED';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION gatepass.enforce_live_tier_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = gatepass, public
AS $$
DECLARE
    q record;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM gatepass.events WHERE id = NEW.event_id AND is_published) THEN
        RETURN NULL;
    END IF;
    IF gatepass.check_is_super_admin() THEN
        RETURN NULL;
    END IF;

    IF NOT gatepass.event_uses_managed_payments(NEW.event_id) THEN
        SELECT * INTO q FROM gatepass.event_platform_fee_quote(NEW.event_id);
        IF NOT q.covered THEN
            RAISE EXCEPTION 'This change takes the event to % tickets, beyond its GatePass plan. Upgrade the plan from the event''s Billing section first.', q.ticket_capacity
                USING HINT = 'PLATFORM_FEE_UPGRADE_REQUIRED';
        END IF;
    END IF;
    IF NEW.price > 0 AND NOT gatepass.event_has_payment_provider(NEW.event_id) THEN
        RAISE EXCEPTION 'Connect and verify a payment provider before selling paid tickets.'
            USING HINT = 'PAYMENT_PROVIDER_REQUIRED';
    END IF;
    RETURN NULL;
END;
$$;
