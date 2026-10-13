-- Bring Your Own Keys: organizer-owned provider credentials for payments, SMS and marketing.
-- Secrets are encrypted in the application layer (AES-256-GCM) before they reach this table,
-- and the table is only reachable through the service role. Clients never read it directly.

CREATE TABLE IF NOT EXISTS gatepass.organizer_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id uuid NOT NULL REFERENCES gatepass.organizers(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('payments', 'sms', 'marketing')),
    provider text NOT NULL,
    mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('test', 'live')),
    -- Non-secret settings (public keys, sender IDs, shortcodes, pixel IDs)
    public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Encrypted JSON blob of secret fields: "v1:<iv>:<tag>:<ciphertext>" (base64 parts)
    encrypted_credentials text,
    -- Last 4 characters of each secret field, for masked display
    credential_hints jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Secret used to sign this integration's inbound webhook URL
    webhook_token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'connected', 'error')),
    status_message text,
    last_verified_at timestamptz,
    is_default boolean NOT NULL DEFAULT false,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organizer_id, category, provider)
);

-- One default integration per organizer per category
CREATE UNIQUE INDEX IF NOT EXISTS organizer_integrations_one_default
    ON gatepass.organizer_integrations (organizer_id, category)
    WHERE is_default;

CREATE INDEX IF NOT EXISTS organizer_integrations_organizer_idx
    ON gatepass.organizer_integrations (organizer_id);

ALTER TABLE gatepass.organizer_integrations ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (server actions) can read or write.

-- Per-event payment provider override (NULL = use the organizer's default)
ALTER TABLE gatepass.events
    ADD COLUMN IF NOT EXISTS payment_integration_id uuid
    REFERENCES gatepass.organizer_integrations(id) ON DELETE SET NULL;

-- payment_gateway is no longer limited to Paystack
ALTER TABLE gatepass.events DROP CONSTRAINT IF EXISTS events_payment_gateway_check;
ALTER TABLE gatepass.events ADD CONSTRAINT events_payment_gateway_check
    CHECK (payment_gateway IN ('paystack', 'stripe', 'flutterwave', 'hubtel', 'mpesa', 'wave'));
