-- Create waitlist table for ticket tier soldout notifications

CREATE TABLE IF NOT EXISTS gatepass.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_id UUID NOT NULL REFERENCES gatepass.events(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES gatepass.ticket_tiers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    notified BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(event_id, tier_id, email)
);

-- Enable RLS
ALTER TABLE gatepass.waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can join waitlist (public)
CREATE POLICY "Public can join waitlist" ON gatepass.waitlist
    FOR INSERT TO public WITH CHECK (true);

-- Organizers can view and update waitlist for their events
CREATE POLICY "Organizers can view waitlist" ON gatepass.waitlist
    FOR SELECT TO authenticated USING (
        event_id IN (
            SELECT id FROM gatepass.events 
            WHERE organization_id IN (
                SELECT organization_id FROM gatepass.organization_team WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Organizers can update waitlist" ON gatepass.waitlist
    FOR UPDATE TO authenticated USING (
        event_id IN (
            SELECT id FROM gatepass.events 
            WHERE organization_id IN (
                SELECT organization_id FROM gatepass.organization_team WHERE user_id = auth.uid()
            )
        )
    );

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_waitlist_tier ON gatepass.waitlist (tier_id, notified);
