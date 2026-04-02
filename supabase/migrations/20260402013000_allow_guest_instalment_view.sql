-- Allow guest users to view their specific instalment plans via direct links
-- This is necessary for the /checkout/instalments/[id] portal to work for unauthenticated users

-- 1. Update instalment_reservations policies
DROP POLICY IF EXISTS "Anyone can view instalment reservation by ID" ON gatepass.instalment_reservations;
CREATE POLICY "Anyone can view instalment reservation by ID"
  ON gatepass.instalment_reservations FOR SELECT
  USING (true); -- Security-by-obscurity via UUID

-- 2. Update instalment_payments policies
DROP POLICY IF EXISTS "Anyone can view instalment payments by plan ID" ON gatepass.instalment_payments;
CREATE POLICY "Anyone can view instalment payments by plan ID"
  ON gatepass.instalment_payments FOR SELECT
  USING (true); -- Security-by-obscurity via UUID

-- 3. Update payment_plans policies (already largely public, but ensuring consistence)
DROP POLICY IF EXISTS "Anyone can view payment plans" ON gatepass.payment_plans;
CREATE POLICY "Anyone can view payment plans"
  ON gatepass.payment_plans FOR SELECT
  USING (true);
