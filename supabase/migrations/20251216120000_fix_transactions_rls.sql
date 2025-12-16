-- Allow Organizers to view transactions for their own events
-- This policy joins transactions -> reservations -> events to check if the current user is the organizer

CREATE POLICY "Organizers can view transactions for their events" ON gatepass.transactions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM gatepass.reservations r
            JOIN gatepass.events e ON r.event_id = e.id
            WHERE gatepass.transactions.reservation_id = r.id
            AND e.organizer_id = auth.uid()
        )
    );
