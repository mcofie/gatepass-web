-- ============================================================
-- INSTALMENT PAYMENTS SYSTEM
-- Allows users to pay for tickets in multiple instalments.
-- Ticket inventory is reserved immediately but tickets are
-- only issued upon full payment completion.
-- ============================================================

-- 1. Add instalment support flag to ticket_tiers
ALTER TABLE gatepass.ticket_tiers
  ADD COLUMN IF NOT EXISTS allow_instalments boolean DEFAULT false;

-- 2. Payment Plans: Defines instalment structure per ticket tier
CREATE TABLE IF NOT EXISTS gatepass.payment_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL,
  event_id uuid NOT NULL,
  
  -- Plan Configuration
  name text NOT NULL DEFAULT 'Instalment Plan',
  num_instalments integer NOT NULL DEFAULT 2,
  initial_percent numeric NOT NULL DEFAULT 50,
  deadline_days integer NOT NULL DEFAULT 7,
  
  -- Behaviour
  is_active boolean NOT NULL DEFAULT true,
  allow_early_completion boolean DEFAULT true,
  forfeit_on_miss boolean DEFAULT false,
  grace_period_hours integer DEFAULT 48,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT payment_plans_pkey PRIMARY KEY (id),
  CONSTRAINT payment_plans_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES gatepass.ticket_tiers(id) ON DELETE CASCADE,
  CONSTRAINT payment_plans_event_id_fkey FOREIGN KEY (event_id) REFERENCES gatepass.events(id) ON DELETE CASCADE,
  CONSTRAINT payment_plans_num_instalments_check CHECK (num_instalments >= 2 AND num_instalments <= 12),
  CONSTRAINT payment_plans_initial_percent_check CHECK (initial_percent >= 10 AND initial_percent <= 90),
  CONSTRAINT payment_plans_deadline_days_check CHECK (deadline_days >= 1 AND deadline_days <= 90)
);

-- 3. Instalment Reservations: Tracks a user's instalment commitment
CREATE TABLE IF NOT EXISTS gatepass.instalment_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  payment_plan_id uuid NOT NULL,
  user_id uuid,
  
  -- Financials
  total_amount numeric NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'GHS',
  
  -- Status
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'forfeited', 'refunded')),
  
  -- Schedule
  next_instalment_due_at timestamptz,
  completed_at timestamptz,
  forfeited_at timestamptz,
  
  -- Contact (for guest users / reminders)
  contact_email text,
  contact_name text,
  contact_phone text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT instalment_reservations_pkey PRIMARY KEY (id),
  CONSTRAINT instalment_reservations_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES gatepass.reservations(id) ON DELETE CASCADE,
  CONSTRAINT instalment_reservations_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES gatepass.payment_plans(id),
  CONSTRAINT instalment_reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES gatepass.profiles(id)
);

-- 4. Instalment Payments: Individual payment records
CREATE TABLE IF NOT EXISTS gatepass.instalment_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instalment_reservation_id uuid NOT NULL,
  
  -- Payment Details
  instalment_number integer NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'GHS',
  
  -- Paystack Reference
  transaction_reference text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'overdue')),
  
  due_at timestamptz NOT NULL,
  paid_at timestamptz,
  
  -- Fee Tracking
  platform_fee numeric DEFAULT 0,
  processor_fee numeric DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT instalment_payments_pkey PRIMARY KEY (id),
  CONSTRAINT instalment_payments_instalment_reservation_id_fkey 
    FOREIGN KEY (instalment_reservation_id) 
    REFERENCES gatepass.instalment_reservations(id) ON DELETE CASCADE
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_plans_tier_id ON gatepass.payment_plans(tier_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_event_id ON gatepass.payment_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_instalment_reservations_reservation_id ON gatepass.instalment_reservations(reservation_id);
CREATE INDEX IF NOT EXISTS idx_instalment_reservations_user_id ON gatepass.instalment_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_instalment_reservations_status ON gatepass.instalment_reservations(status);
CREATE INDEX IF NOT EXISTS idx_instalment_payments_reservation_id ON gatepass.instalment_payments(instalment_reservation_id);
CREATE INDEX IF NOT EXISTS idx_instalment_payments_status ON gatepass.instalment_payments(status);
CREATE INDEX IF NOT EXISTS idx_instalment_payments_due_at ON gatepass.instalment_payments(due_at);

-- 6. RLS Policies
ALTER TABLE gatepass.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE gatepass.instalment_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gatepass.instalment_payments ENABLE ROW LEVEL SECURITY;

-- Payment Plans: Public read (for checkout display), org admin write
CREATE POLICY "Anyone can view active payment plans"
  ON gatepass.payment_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage payment plans"
  ON gatepass.payment_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM gatepass.events e
      JOIN gatepass.organizers o ON e.organization_id = o.id
      JOIN gatepass.organization_team ot ON ot.organization_id = o.id
      WHERE e.id = payment_plans.event_id
      AND ot.user_id = auth.uid()
    )
  );

-- Instalment Reservations: User can see own, org admin can see all for their events
CREATE POLICY "Users can view own instalment reservations"
  ON gatepass.instalment_reservations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own instalment reservations"
  ON gatepass.instalment_reservations FOR UPDATE
  USING (user_id = auth.uid());

-- Instalment Payments: User can see own
CREATE POLICY "Users can view own instalment payments"
  ON gatepass.instalment_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gatepass.instalment_reservations ir
      WHERE ir.id = instalment_payments.instalment_reservation_id
      AND ir.user_id = auth.uid()
    )
  );

-- 7. Helper RPC: Release instalment reservation (decrement inventory)
CREATE OR REPLACE FUNCTION gatepass.release_instalment_reservation(p_instalment_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id uuid;
  v_tier_id uuid;
  v_quantity integer;
BEGIN
  -- Get reservation details
  SELECT ir.reservation_id INTO v_reservation_id
  FROM gatepass.instalment_reservations ir
  WHERE ir.id = p_instalment_reservation_id AND ir.status = 'active';

  IF v_reservation_id IS NULL THEN
    RAISE EXCEPTION 'Instalment reservation not found or not active';
  END IF;

  -- Get tier and quantity from reservation
  SELECT r.tier_id, r.quantity INTO v_tier_id, v_quantity
  FROM gatepass.reservations r
  WHERE r.id = v_reservation_id;

  -- Update instalment reservation status
  UPDATE gatepass.instalment_reservations
  SET status = 'forfeited', forfeited_at = now(), updated_at = now()
  WHERE id = p_instalment_reservation_id;

  -- Update reservation status
  UPDATE gatepass.reservations
  SET status = 'cancelled'
  WHERE id = v_reservation_id;

  -- Release inventory
  UPDATE gatepass.ticket_tiers
  SET quantity_sold = GREATEST(0, quantity_sold - v_quantity)
  WHERE id = v_tier_id;

  -- Mark pending instalment payments as failed
  UPDATE gatepass.instalment_payments
  SET status = 'failed'
  WHERE instalment_reservation_id = p_instalment_reservation_id
  AND status IN ('pending', 'overdue');
END;
$$;
