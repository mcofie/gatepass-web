-- Create marketing_stats table to track performance of marketing campaigns
CREATE TABLE IF NOT EXISTS gatepass.marketing_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES gatepass.events(id) ON DELETE CASCADE,
    utm_source TEXT NOT NULL,
    utm_medium TEXT,
    utm_campaign TEXT,
    views INTEGER DEFAULT 0,
    transactions INTEGER DEFAULT 0,
    revenue NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'GHS',
    last_viewed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, utm_source, utm_medium, utm_campaign)
);

-- Enable RLS
ALTER TABLE gatepass.marketing_stats ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public track views" ON gatepass.marketing_stats
    FOR ALL USING (true); -- We'll use a SECURITY DEFINER function for updates

-- Function to track marketing events (views)
CREATE OR REPLACE FUNCTION gatepass.track_marketing_event(
    p_event_id UUID,
    p_utm_source TEXT,
    p_utm_medium TEXT DEFAULT NULL,
    p_utm_campaign TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO gatepass.marketing_stats (
        event_id,
        utm_source,
        utm_medium,
        utm_campaign,
        views,
        last_viewed_at
    )
    VALUES (
        p_event_id,
        p_utm_source,
        p_utm_medium,
        p_utm_campaign,
        1,
        now()
    )
    ON CONFLICT (event_id, utm_source, utm_medium, utm_campaign)
    DO UPDATE SET
        views = gatepass.marketing_stats.views + 1,
        last_viewed_at = now(),
        updated_at = now();
END;
$$;

-- Function to track marketing conversions (transactions/revenue)
CREATE OR REPLACE FUNCTION gatepass.track_marketing_conversion(
    p_event_id UUID,
    p_utm_source TEXT,
    p_utm_medium TEXT DEFAULT NULL,
    p_utm_campaign TEXT DEFAULT NULL,
    p_revenue NUMERIC DEFAULT 0,
    p_currency TEXT DEFAULT 'GHS'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO gatepass.marketing_stats (
        event_id,
        utm_source,
        utm_medium,
        utm_campaign,
        transactions,
        revenue,
        currency
    )
    VALUES (
        p_event_id,
        p_utm_source,
        p_utm_medium,
        p_utm_campaign,
        1,
        p_revenue,
        p_currency
    )
    ON CONFLICT (event_id, utm_source, utm_medium, utm_campaign)
    DO UPDATE SET
        transactions = gatepass.marketing_stats.transactions + 1,
        revenue = gatepass.marketing_stats.revenue + p_revenue,
        currency = p_currency,
        updated_at = now();
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION gatepass.track_marketing_event(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION gatepass.track_marketing_conversion(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
GRANT ALL ON TABLE gatepass.marketing_stats TO service_role;
GRANT SELECT ON TABLE gatepass.marketing_stats TO authenticated;
