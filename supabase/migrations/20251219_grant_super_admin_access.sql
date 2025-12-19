-- 1. Events Table: Allow Super Admins to view and manage all events
DROP POLICY IF EXISTS "Super Admins can view all events" ON gatepass.events;
CREATE POLICY "Super Admins can view all events" ON gatepass.events
    FOR SELECT
    TO authenticated
    USING (gatepass.check_is_super_admin());

DROP POLICY IF EXISTS "Super Admins can manage all events" ON gatepass.events;
CREATE POLICY "Super Admins can manage all events" ON gatepass.events
    FOR ALL
    TO authenticated
    USING (gatepass.check_is_super_admin());

-- 2. Transactions Table: Allow Super Admins to view all transactions
DROP POLICY IF EXISTS "Super Admins can view all transactions" ON gatepass.transactions;
CREATE POLICY "Super Admins can view all transactions" ON gatepass.transactions
    FOR SELECT
    TO authenticated
    USING (gatepass.check_is_super_admin());

-- 3. Reservations Table: Ensure Super Admins can view all (reservations had a public policy but better to be safe)
DROP POLICY IF EXISTS "Super Admins can view all reservations" ON gatepass.reservations;
CREATE POLICY "Super Admins can view all reservations" ON gatepass.reservations
    FOR SELECT
    TO authenticated
    USING (gatepass.check_is_super_admin());

-- 4. Discounts Table: Allow Super Admins to manage all
DROP POLICY IF EXISTS "Super Admins can manage all discounts" ON gatepass.discounts;
CREATE POLICY "Super Admins can manage all discounts" ON gatepass.discounts
    FOR ALL
    TO authenticated
    USING (gatepass.check_is_super_admin());

-- 5. Organization Team Table: Allow Super Admins to view all
DROP POLICY IF EXISTS "Super Admins can view all team members" ON gatepass.organization_team;
CREATE POLICY "Super Admins can view all team members" ON gatepass.organization_team
    FOR SELECT
    TO authenticated
    USING (gatepass.check_is_super_admin());

-- 6. Ticket Tiers: Super Admins manage
DROP POLICY IF EXISTS "Super Admins can manage all ticket tiers" ON gatepass.ticket_tiers;
CREATE POLICY "Super Admins can manage all ticket tiers" ON gatepass.ticket_tiers
    FOR ALL
    TO authenticated
    USING (gatepass.check_is_super_admin());

-- 7. Tickets Table (Guest List): Super Admins view all
DROP POLICY IF EXISTS "Super Admins can view all tickets" ON gatepass.tickets;
CREATE POLICY "Super Admins can view all tickets" ON gatepass.tickets
    FOR SELECT
    TO authenticated
    USING (gatepass.check_is_super_admin());

-- 8. Event Staff Table: Super Admins manage all
DROP POLICY IF EXISTS "Super Admins can manage all staff" ON gatepass.event_staff;
CREATE POLICY "Super Admins can manage all staff" ON gatepass.event_staff
    FOR ALL
    TO authenticated
    USING (gatepass.check_is_super_admin());
