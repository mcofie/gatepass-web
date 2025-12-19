-- Enable RLS on tickets and ticket_tiers if not already enabled
ALTER TABLE gatepass.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gatepass.ticket_tiers ENABLE ROW LEVEL SECURITY;

-- DROP existing policies to avoid conflicts
DROP POLICY IF EXISTS "Organizers can view own tickets" ON gatepass.tickets;
DROP POLICY IF EXISTS "Team members can view organization tickets" ON gatepass.tickets;
DROP POLICY IF EXISTS "Event staff can view event tickets" ON gatepass.tickets;
DROP POLICY IF EXISTS "Organizers can view own ticket tiers" ON gatepass.ticket_tiers;
DROP POLICY IF EXISTS "Team members can view organization ticket tiers" ON gatepass.ticket_tiers;
DROP POLICY IF EXISTS "Event staff can view event ticket tiers" ON gatepass.ticket_tiers;

-- TICKETS POLICIES

-- 1. Organizers (Direct event owner)
CREATE POLICY "Organizers can view own tickets" ON gatepass.tickets
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.events e
            WHERE e.id = gatepass.tickets.event_id
            AND e.organizer_id = auth.uid()
        )
    );

-- 2. Organization Team Members (Admins/Staff of the organization)
CREATE POLICY "Team members can view organization tickets" ON gatepass.tickets
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.events e
            JOIN gatepass.organization_team ot ON e.organization_id = ot.organization_id
            WHERE e.id = gatepass.tickets.event_id
            AND ot.user_id = auth.uid()
        )
    );

-- 3. Specific Event Staff (Assigned to the event via email)
CREATE POLICY "Event staff can view event tickets" ON gatepass.tickets
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.event_staff es
            WHERE es.event_id = gatepass.tickets.event_id
            AND es.email = auth.jwt() ->> 'email'
        )
    );

-- UPDATE POLICIES (For check-in)

CREATE POLICY "Organizers and team can update tickets" ON gatepass.tickets
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.events e
            WHERE e.id = gatepass.tickets.event_id
            AND (
                e.organizer_id = auth.uid() OR
                EXISTS (SELECT 1 FROM gatepass.organization_team ot WHERE ot.organization_id = e.organization_id AND ot.user_id = auth.uid())
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM gatepass.events e
            WHERE e.id = gatepass.tickets.event_id
            AND (
                e.organizer_id = auth.uid() OR
                EXISTS (SELECT 1 FROM gatepass.organization_team ot WHERE ot.organization_id = e.organization_id AND ot.user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Event staff can update event tickets" ON gatepass.tickets
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.event_staff es
            WHERE es.event_id = gatepass.tickets.event_id
            AND es.email = auth.jwt() ->> 'email'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM gatepass.event_staff es
            WHERE es.event_id = gatepass.tickets.event_id
            AND es.email = auth.jwt() ->> 'email'
        )
    );

-- TICKET TIERS POLICIES (Required for the join in AttendeesTab)

-- 1. Organizers (Full Control)
DROP POLICY IF EXISTS "Organizers can manage own ticket tiers" ON gatepass.ticket_tiers;
CREATE POLICY "Organizers can manage own ticket tiers" ON gatepass.ticket_tiers
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.events e
            WHERE e.id = gatepass.ticket_tiers.event_id
            AND e.organizer_id = auth.uid()
        )
    );

-- 2. Organization Team Members (View Only for Staff, but Admin might need more - for now restricting both as per request)
DROP POLICY IF EXISTS "Team members can view organization ticket tiers" ON gatepass.ticket_tiers;
CREATE POLICY "Team members can view organization ticket tiers" ON gatepass.ticket_tiers
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.events e
            JOIN gatepass.organization_team ot ON e.organization_id = ot.organization_id
            WHERE e.id = gatepass.ticket_tiers.event_id
            AND ot.user_id = auth.uid()
        )
    );

-- 3. Specific Event Staff (View Only)
DROP POLICY IF EXISTS "Event staff can view event ticket tiers" ON gatepass.ticket_tiers;
CREATE POLICY "Event staff can view event ticket tiers" ON gatepass.ticket_tiers
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.event_staff es
            WHERE es.event_id = gatepass.ticket_tiers.event_id
            AND es.email = auth.jwt() ->> 'email'
        )
    );

-- Also ensure Public can view ticket tiers (for the booking page)
DROP POLICY IF EXISTS "Public can view ticket tiers" ON gatepass.ticket_tiers;
CREATE POLICY "Public can view ticket tiers" ON gatepass.ticket_tiers
    FOR SELECT
    TO public
    USING (true);

-- PROFILES POLICIES

-- Allow Organizers and Staff to view profiles of their event attendees
DROP POLICY IF EXISTS "Organizers and staff can view attendee profiles" ON gatepass.profiles;
CREATE POLICY "Organizers and staff can view attendee profiles" ON gatepass.profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.tickets t
            JOIN gatepass.events e ON t.event_id = e.id
            WHERE t.user_id = gatepass.profiles.id
            AND (
                e.organizer_id = auth.uid() OR
                EXISTS (SELECT 1 FROM gatepass.organization_team ot WHERE ot.organization_id = e.organization_id AND ot.user_id = auth.uid()) OR
                EXISTS (SELECT 1 FROM gatepass.event_staff es WHERE es.event_id = e.id AND es.email = auth.jwt() ->> 'email')
            )
        )
    );

-- EVENTS POLICIES (Additional for staff)

DROP POLICY IF EXISTS "Staff can view their organization events" ON gatepass.events;
CREATE POLICY "Staff can view their organization events" ON gatepass.events
    FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM gatepass.organization_team WHERE user_id = auth.uid()
        )
    );

-- TRANSACTIONS POLICIES (For staff viewing stats)

DROP POLICY IF EXISTS "Staff can view transactions" ON gatepass.transactions;
CREATE POLICY "Staff can view transactions" ON gatepass.transactions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.reservations r
            JOIN gatepass.events e ON r.event_id = e.id
            WHERE gatepass.transactions.reservation_id = r.id
            AND (
                EXISTS (SELECT 1 FROM gatepass.organization_team ot WHERE ot.organization_id = e.organization_id AND ot.user_id = auth.uid()) OR
                EXISTS (SELECT 1 FROM gatepass.event_staff es WHERE es.event_id = e.id AND es.email = auth.jwt() ->> 'email')
            )
        )
    );
