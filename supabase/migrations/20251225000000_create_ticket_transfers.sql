-- Create ticket_transfers table
CREATE TABLE IF NOT EXISTS gatepass.ticket_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES gatepass.tickets(id),
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    recipient_email TEXT, -- Optional, if specific email targeted
    claim_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'claimed', 'cancelled')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_token ON gatepass.ticket_transfers(claim_token);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_sender ON gatepass.ticket_transfers(sender_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket ON gatepass.ticket_transfers(ticket_id);

-- RLS
ALTER TABLE gatepass.ticket_transfers ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Senders can view their transfers" ON gatepass.ticket_transfers;
CREATE POLICY "Senders can view their transfers" ON gatepass.ticket_transfers
    FOR SELECT USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Public view by token" ON gatepass.ticket_transfers;
CREATE POLICY "Public view by token" ON gatepass.ticket_transfers
    FOR SELECT USING (true); 

DROP POLICY IF EXISTS "Senders can create transfers" ON gatepass.ticket_transfers;
CREATE POLICY "Senders can create transfers" ON gatepass.ticket_transfers
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Senders can update their transfers" ON gatepass.ticket_transfers;
CREATE POLICY "Senders can update their transfers" ON gatepass.ticket_transfers
    FOR UPDATE USING (auth.uid() = sender_id);

-- RPC for atomic claim
DROP FUNCTION IF EXISTS gatepass.claim_transfer(TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.claim_transfer(
    p_token TEXT,
    p_claimer_id UUID,
    p_new_qr_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, gatepass
AS $$
DECLARE
    v_transfer_id UUID;
    v_ticket_id UUID;
    v_status TEXT;
    v_expires_at TIMESTAMPTZ;
    v_sender_id UUID;
BEGIN
    -- 1. Get Transfer Info
    SELECT id, ticket_id, status, expires_at, sender_id
    INTO v_transfer_id, v_ticket_id, v_status, v_expires_at, v_sender_id
    FROM gatepass.ticket_transfers
    WHERE claim_token = p_token
    FOR UPDATE;

    IF v_transfer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid transfer link');
    END IF;

    IF v_sender_id = p_claimer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot claim your own transfer');
    END IF;

    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This ticket has already been claimed or cancelled');
    END IF;

    IF v_expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'This transfer link has expired');
    END IF;

    -- 2. Update Ticket Ownership & Rotate QR
    UPDATE gatepass.tickets
    SET user_id = p_claimer_id,
        qr_code_hash = p_new_qr_hash
        -- updated_at trigger usually handles timestamp
    WHERE id = v_ticket_id;

    -- 3. Mark Transfer as Claimed
    UPDATE gatepass.ticket_transfers
    SET status = 'claimed'
    WHERE id = v_transfer_id;

    RETURN jsonb_build_object('success', true, 'ticketId', v_ticket_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_transfer(TEXT, UUID, TEXT) TO authenticated, service_role;

