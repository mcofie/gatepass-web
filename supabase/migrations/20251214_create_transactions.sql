-- Create transactions table in gatepass schema
CREATE TABLE IF NOT EXISTS gatepass.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID REFERENCES gatepass.reservations(id),
    reference TEXT UNIQUE NOT NULL,
    amount NUMERIC,
    currency TEXT,
    channel TEXT,
    status TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS Policies (Optional but recommended)
ALTER TABLE gatepass.transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own transactions (via linked reservation)
CREATE POLICY "Users can view their own transactions" ON gatepass.transactions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM gatepass.reservations
            WHERE gatepass.transactions.reservation_id = gatepass.reservations.id
            AND gatepass.reservations.user_id = auth.uid()
        )
    );
