-- Every checkout started with an organizer's own payment provider.
-- The reference is ours (≤ 32 chars so it fits Hubtel's clientReference) and is what callbacks,
-- webhooks and the status page look up. Verification compares the provider's amount to amount_minor.

CREATE TABLE IF NOT EXISTS gatepass.payment_sessions (
    reference text PRIMARY KEY,
    organizer_id uuid NOT NULL REFERENCES gatepass.organizers(id) ON DELETE CASCADE,
    integration_id uuid REFERENCES gatepass.organizer_integrations(id) ON DELETE SET NULL,
    provider text NOT NULL,
    mode text NOT NULL DEFAULT 'live',
    -- Provider-side id when it differs from our reference (Stripe/Wave session id, M-Pesa CheckoutRequestID)
    provider_reference text,
    -- Amount × 100, matching what checkout clients send
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    currency text NOT NULL,
    reservation_ids uuid[] NOT NULL DEFAULT '{}',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    -- Normalized transaction returned by the provider once paid
    transaction jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS payment_sessions_provider_reference_idx
    ON gatepass.payment_sessions (provider, provider_reference);

ALTER TABLE gatepass.payment_sessions ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reads or writes sessions.
