-- Finalized policies for organization admins to view instalment reservations and payments
-- Based on the provided gatepass schema

-- 1. Policy for Instalment Reservations
DROP POLICY IF EXISTS "Allow organization admins to view instalment reservations" ON gatepass.instalment_reservations;
CREATE POLICY "Allow organization admins to view instalment reservations"
ON gatepass.instalment_reservations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM gatepass.payment_plans pp
        JOIN gatepass.events e ON e.id = pp.event_id
        LEFT JOIN gatepass.organizers o ON o.id = e.organization_id
        LEFT JOIN gatepass.organization_team ot ON ot.organization_id = e.organization_id
        WHERE pp.id = instalment_reservations.payment_plan_id
        AND (
            e.organizer_id = auth.uid() OR 
            o.user_id = auth.uid() OR 
            ot.user_id = auth.uid()
        )
    ) 
    OR (SELECT is_super_admin FROM gatepass.profiles WHERE id = auth.uid())
);

-- 2. Policy for Instalment Payments
DROP POLICY IF EXISTS "Allow organization admins to view instalment payments" ON gatepass.instalment_payments;
CREATE POLICY "Allow organization admins to view instalment payments"
ON gatepass.instalment_payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM gatepass.instalment_reservations ir
        JOIN gatepass.payment_plans pp ON pp.id = ir.payment_plan_id
        JOIN gatepass.events e ON e.id = pp.event_id
        LEFT JOIN gatepass.organizers o ON o.id = e.organization_id
        LEFT JOIN gatepass.organization_team ot ON ot.organization_id = e.organization_id
        WHERE ir.id = instalment_payments.instalment_reservation_id
        AND (
            e.organizer_id = auth.uid() OR 
            o.user_id = auth.uid() OR 
            ot.user_id = auth.uid()
        )
    )
    OR (SELECT is_super_admin FROM gatepass.profiles WHERE id = auth.uid())
);
