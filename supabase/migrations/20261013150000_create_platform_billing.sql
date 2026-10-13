-- One-time GatePass platform fee per event, priced by ticket capacity.
-- Replaces the per-ticket platform fee: organizers now take payments with their own provider keys.

-- 1. Pricing tiers (editable by super admins in /admin/settings)
CREATE TABLE IF NOT EXISTS gatepass.platform_pricing_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    -- Largest total ticket capacity this tier covers; NULL = unlimited
    max_tickets integer CHECK (max_tickets IS NULL OR max_tickets > 0),
    price_minor bigint NOT NULL CHECK (price_minor >= 0),
    currency text NOT NULL DEFAULT 'GHS',
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gatepass.platform_pricing_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active pricing tiers" ON gatepass.platform_pricing_tiers;
CREATE POLICY "Anyone can read active pricing tiers" ON gatepass.platform_pricing_tiers
    FOR SELECT USING (is_active);

-- Seed tiers (placeholders; adjust in /admin/settings)
INSERT INTO gatepass.platform_pricing_tiers (name, description, max_tickets, price_minor, currency, sort_order)
SELECT * FROM (VALUES
    ('Starter',    'Small gatherings and community events', 100,   0,       'GHS', 1),
    ('Standard',   'Parties, workshops and club nights',    500,   25000,   'GHS', 2),
    ('Growth',     'Concerts and conferences',              2000,  75000,   'GHS', 3),
    ('Large',      'Festivals and arena shows',             10000, 200000,  'GHS', 4),
    ('Enterprise', 'Over 10,000 tickets',                   NULL,  500000,  'GHS', 5)
) AS seed(name, description, max_tickets, price_minor, currency, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM gatepass.platform_pricing_tiers);

-- 2. What each event has paid. No row = unpaid. Only the service role writes here,
--    so organizers cannot mark their own events as paid.
CREATE TABLE IF NOT EXISTS gatepass.event_billing (
    event_id uuid PRIMARY KEY REFERENCES gatepass.events(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('paid', 'waived')),
    tier_id uuid REFERENCES gatepass.platform_pricing_tiers(id) ON DELETE SET NULL,
    paid_minor bigint NOT NULL DEFAULT 0,
    currency text,
    -- Ticket capacity the payment covers; NULL = unlimited
    covered_tickets integer,
    paid_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE gatepass.event_billing ENABLE ROW LEVEL SECURITY;

-- Grandfather every existing event
INSERT INTO gatepass.event_billing (event_id, status)
SELECT id, 'waived' FROM gatepass.events
ON CONFLICT (event_id) DO NOTHING;

-- 3. Platform fee checkouts (paid to GatePass's own Paystack account)
CREATE TABLE IF NOT EXISTS gatepass.platform_fee_payments (
    reference text PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES gatepass.events(id) ON DELETE CASCADE,
    organizer_id uuid NOT NULL REFERENCES gatepass.organizers(id) ON DELETE CASCADE,
    tier_id uuid REFERENCES gatepass.platform_pricing_tiers(id) ON DELETE SET NULL,
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    currency text NOT NULL,
    covered_tickets integer,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS platform_fee_payments_event_idx ON gatepass.platform_fee_payments (event_id);
ALTER TABLE gatepass.platform_fee_payments ENABLE ROW LEVEL SECURITY;

-- 4. Quote: which tier an event needs, what is still due, and whether it is covered
CREATE OR REPLACE FUNCTION gatepass.event_platform_fee_quote(p_event_id uuid)
RETURNS TABLE (
    tier_id uuid,
    tier_name text,
    ticket_capacity integer,
    price_minor bigint,
    currency text,
    paid_minor bigint,
    amount_due_minor bigint,
    covered boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = gatepass, public
AS $$
    WITH cap AS (
        -- A tier without a quantity limit makes the event unlimited
        SELECT CASE WHEN bool_or(total_quantity IS NULL) THEN 2147483647
                    ELSE coalesce(sum(total_quantity), 0) END::integer AS n
        FROM gatepass.ticket_tiers WHERE event_id = p_event_id
    ),
    tier AS (
        SELECT t.* FROM gatepass.platform_pricing_tiers t, cap
        WHERE t.is_active AND (t.max_tickets IS NULL OR t.max_tickets >= cap.n)
        ORDER BY coalesce(t.max_tickets, 2147483647), t.sort_order
        LIMIT 1
    ),
    billing AS (
        SELECT * FROM gatepass.event_billing WHERE event_id = p_event_id
    )
    SELECT
        tier.id,
        tier.name,
        cap.n,
        tier.price_minor,
        tier.currency,
        coalesce(billing.paid_minor, 0),
        greatest(coalesce(tier.price_minor, 0) - coalesce(billing.paid_minor, 0), 0),
        coalesce(billing.status = 'waived', false)
            OR (billing.status = 'paid' AND (billing.covered_tickets IS NULL OR billing.covered_tickets >= cap.n))
            OR coalesce(tier.price_minor, 1) = 0
    FROM cap
    LEFT JOIN tier ON true
    LEFT JOIN billing ON true;
$$;
REVOKE ALL ON FUNCTION gatepass.event_platform_fee_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gatepass.event_platform_fee_quote(uuid) TO authenticated, service_role;

-- True when the event's paid tickets can actually be charged: a verified payment integration
-- (the event override, or the organization default) exists.
CREATE OR REPLACE FUNCTION gatepass.event_has_payment_provider(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = gatepass, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM gatepass.events e
        JOIN gatepass.organizer_integrations i
          ON i.organizer_id = e.organization_id AND i.category = 'payments' AND i.status = 'connected'
        WHERE e.id = p_event_id
          AND (i.id = e.payment_integration_id OR (e.payment_integration_id IS NULL AND i.is_default))
    );
$$;
REVOKE ALL ON FUNCTION gatepass.event_has_payment_provider(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gatepass.event_has_payment_provider(uuid) TO authenticated, service_role;

-- 5. Enforcement. Publishing happens from the browser, so the rules live in the database.
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

    SELECT * INTO q FROM gatepass.event_platform_fee_quote(NEW.id);
    IF q.tier_id IS NULL THEN
        RAISE EXCEPTION 'No GatePass plan covers % tickets. Please contact support.', q.ticket_capacity
            USING HINT = 'PLATFORM_FEE_NO_TIER';
    END IF;
    IF NOT q.covered THEN
        RAISE EXCEPTION 'Pay the GatePass platform fee before publishing this event.'
            USING HINT = 'PLATFORM_FEE_UNPAID';
    END IF;
    IF EXISTS (SELECT 1 FROM gatepass.ticket_tiers WHERE event_id = NEW.id AND price > 0)
       AND NOT gatepass.event_has_payment_provider(NEW.id) THEN
        RAISE EXCEPTION 'Connect and verify a payment provider before publishing an event with paid tickets.'
            USING HINT = 'PAYMENT_PROVIDER_REQUIRED';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_event_publish_requirements ON gatepass.events;
CREATE TRIGGER enforce_event_publish_requirements
    BEFORE INSERT OR UPDATE OF is_published ON gatepass.events
    FOR EACH ROW EXECUTE FUNCTION gatepass.enforce_event_publish_requirements();

-- Live events cannot outgrow their plan or start charging without a provider.
-- AFTER trigger so the quote sees the new capacity; raising rolls the change back.
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

    SELECT * INTO q FROM gatepass.event_platform_fee_quote(NEW.event_id);
    IF NOT q.covered THEN
        RAISE EXCEPTION 'This change takes the event to % tickets, beyond its GatePass plan. Upgrade the plan from the event''s Billing section first.', q.ticket_capacity
            USING HINT = 'PLATFORM_FEE_UPGRADE_REQUIRED';
    END IF;
    IF NEW.price > 0 AND NOT gatepass.event_has_payment_provider(NEW.event_id) THEN
        RAISE EXCEPTION 'Connect and verify a payment provider before selling paid tickets.'
            USING HINT = 'PAYMENT_PROVIDER_REQUIRED';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS enforce_live_tier_changes ON gatepass.ticket_tiers;
CREATE TRIGGER enforce_live_tier_changes
    AFTER INSERT OR UPDATE OF total_quantity, price ON gatepass.ticket_tiers
    FOR EACH ROW EXECUTE FUNCTION gatepass.enforce_live_tier_changes();
