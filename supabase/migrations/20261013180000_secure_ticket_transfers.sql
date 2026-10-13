-- Ticket transfers, tightened:
--  * transfers are no longer readable by everyone (claim tokens were exposed); the claim page reads by token on the server
--  * only the ticket's current owner can start a transfer, and only for a valid ticket
--  * one live link per ticket; senders can only cancel
--  * claiming checks the caller (auth.uid()), current ownership, ticket status, event end and the intended recipient

ALTER TABLE gatepass.ticket_transfers
    ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Keep only the newest pending transfer per ticket before adding the uniqueness rule
UPDATE gatepass.ticket_transfers t
SET status = 'cancelled', cancelled_at = now()
WHERE t.status = 'pending'
  AND EXISTS (
      SELECT 1 FROM gatepass.ticket_transfers newer
      WHERE newer.ticket_id = t.ticket_id
        AND newer.status = 'pending'
        AND (newer.created_at, newer.id) > (t.created_at, t.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS ticket_transfers_one_pending_per_ticket
    ON gatepass.ticket_transfers (ticket_id) WHERE status = 'pending';

-- Policies
DROP POLICY IF EXISTS "Public view by token" ON gatepass.ticket_transfers;
DROP POLICY IF EXISTS "Senders can view their transfers" ON gatepass.ticket_transfers;
DROP POLICY IF EXISTS "Senders can create transfers" ON gatepass.ticket_transfers;
DROP POLICY IF EXISTS "Senders can update their transfers" ON gatepass.ticket_transfers;
DROP POLICY IF EXISTS "Senders can cancel their transfers" ON gatepass.ticket_transfers;

CREATE POLICY "Senders can view their transfers" ON gatepass.ticket_transfers
    FOR SELECT TO authenticated
    USING (sender_id = auth.uid());

CREATE POLICY "Senders can create transfers" ON gatepass.ticket_transfers
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND status = 'pending'
        AND EXISTS (
            SELECT 1 FROM gatepass.tickets tk
            WHERE tk.id = ticket_id AND tk.user_id = auth.uid() AND tk.status = 'valid'
        )
    );

CREATE POLICY "Senders can cancel their transfers" ON gatepass.ticket_transfers
    FOR UPDATE TO authenticated
    USING (sender_id = auth.uid() AND status = 'pending')
    WITH CHECK (sender_id = auth.uid() AND status = 'cancelled');

-- Claim: identity comes from auth.uid(), never from a parameter
DROP FUNCTION IF EXISTS public.claim_transfer(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS gatepass.claim_transfer(TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.claim_transfer(p_token TEXT, p_new_qr_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, gatepass
AS $$
DECLARE
    v_claimer uuid := auth.uid();
    v_claimer_email text;
    v_transfer gatepass.ticket_transfers%ROWTYPE;
    v_ticket gatepass.tickets%ROWTYPE;
    v_event_end timestamptz;
BEGIN
    IF v_claimer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sign in to claim this ticket');
    END IF;

    IF p_new_qr_hash IS NULL OR length(p_new_qr_hash) < 32 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid request');
    END IF;

    SELECT * INTO v_transfer FROM gatepass.ticket_transfers WHERE claim_token = p_token FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'This transfer link isn''t valid');
    END IF;

    IF v_transfer.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', CASE v_transfer.status WHEN 'claimed' THEN 'This ticket has already been claimed' ELSE 'The sender cancelled this transfer' END);
    END IF;

    IF v_transfer.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'This transfer link has expired. Ask the sender for a new one.');
    END IF;

    IF v_transfer.sender_id = v_claimer THEN
        RETURN jsonb_build_object('success', false, 'error', 'You can''t claim your own transfer');
    END IF;

    IF v_transfer.recipient_email IS NOT NULL THEN
        SELECT email INTO v_claimer_email FROM auth.users WHERE id = v_claimer;
        IF lower(coalesce(v_claimer_email, '')) <> lower(v_transfer.recipient_email) THEN
            RETURN jsonb_build_object('success', false, 'error', 'This ticket was sent to a different email. Sign in with that email to claim it.');
        END IF;
    END IF;

    SELECT * INTO v_ticket FROM gatepass.tickets WHERE id = v_transfer.ticket_id FOR UPDATE;
    IF NOT FOUND OR v_ticket.user_id IS DISTINCT FROM v_transfer.sender_id OR v_ticket.status <> 'valid' THEN
        UPDATE gatepass.ticket_transfers SET status = 'cancelled', cancelled_at = now() WHERE id = v_transfer.id;
        RETURN jsonb_build_object('success', false, 'error', 'This ticket can no longer be transferred');
    END IF;

    SELECT coalesce(e.ends_at, e.starts_at + interval '12 hours') INTO v_event_end FROM gatepass.events e WHERE e.id = v_ticket.event_id;
    IF v_event_end IS NOT NULL AND v_event_end < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'This event has ended');
    END IF;

    UPDATE gatepass.tickets
    SET user_id = v_claimer, qr_code_hash = p_new_qr_hash
    WHERE id = v_ticket.id;

    UPDATE gatepass.ticket_transfers
    SET status = 'claimed', claimed_by = v_claimer, claimed_at = now()
    WHERE id = v_transfer.id;

    RETURN jsonb_build_object('success', true, 'ticketId', v_ticket.id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_transfer(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_transfer(TEXT, TEXT) TO authenticated;
