-- Fix RLS policies for events table
-- This migration ensures that organizers can view, insert, update, and delete their own events.

-- Enable RLS (idempotent)
ALTER TABLE gatepass.events ENABLE ROW LEVEL SECURITY;

-- DROP existing policies to be safe (if names match, otherwise this might error if policy names differ, but standard naming helps)
DROP POLICY IF EXISTS "Organizers can view own events" ON gatepass.events;
DROP POLICY IF EXISTS "Organizers can insert own events" ON gatepass.events;
DROP POLICY IF EXISTS "Organizers can update own events" ON gatepass.events;
DROP POLICY IF EXISTS "Organizers can delete own events" ON gatepass.events;

-- SELECT: Allow users to view events they created OR events belonging to their organization
CREATE POLICY "Organizers can view own events" ON gatepass.events
    FOR SELECT
    USING (
        organizer_id = auth.uid() OR 
        organization_id IN (
            SELECT id FROM gatepass.organizers WHERE user_id = auth.uid()
        )
    );

-- INSERT: Allow users to insert events if they are the organizer
CREATE POLICY "Organizers can insert own events" ON gatepass.events
    FOR INSERT
    WITH CHECK (
        organizer_id = auth.uid()
    );

-- UPDATE: Allow users to update their own events
CREATE POLICY "Organizers can update own events" ON gatepass.events
    FOR UPDATE
    USING (
        organizer_id = auth.uid() OR 
        organization_id IN (
            SELECT id FROM gatepass.organizers WHERE user_id = auth.uid()
        )
    );

-- DELETE: Allow users to delete their own events
CREATE POLICY "Organizers can delete own events" ON gatepass.events
    FOR DELETE
    USING (
        organizer_id = auth.uid() OR 
        organization_id IN (
            SELECT id FROM gatepass.organizers WHERE user_id = auth.uid()
        )
    );
