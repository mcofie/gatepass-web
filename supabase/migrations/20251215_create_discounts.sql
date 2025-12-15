-- Create discounts table
CREATE TABLE IF NOT EXISTS gatepass.discounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    event_id UUID REFERENCES gatepass.events(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value NUMERIC NOT NULL CHECK (value >= 0),
    max_uses INTEGER, -- NULL means unlimited
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    
    -- Ensure code is unique per event, case-insensitive logic should be handled by app or upper(code)
    UNIQUE(event_id, code)
);

-- RLS Policies
ALTER TABLE gatepass.discounts ENABLE ROW LEVEL SECURITY;

-- Everyone can view discounts (needed for checkout validation)
-- But actually, we only want to "view" if we know the code. 
-- For now, allow public read so we can query `select * from discounts where code = X and event_id = Y`.
CREATE POLICY "Public read access" ON gatepass.discounts
    FOR SELECT USING (true);

-- Only event organizer can insert/update/delete
CREATE POLICY "Organizers can manage discounts" ON gatepass.discounts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.events
            WHERE id = gatepass.discounts.event_id
            AND organizer_id = auth.uid()
        )
    );
