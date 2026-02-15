-- Re-create marketing tracking functions in the gatepass schema as requested
DROP FUNCTION IF EXISTS public.track_marketing_event(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.track_marketing_conversion(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS gatepass.track_marketing_event(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS gatepass.track_marketing_conversion(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT);

-- Fix the unique constraint on marketing_stats to handle NULLs correctly for UTM parameters
-- 1. Drop the existing unique constraint if it exists (it doesn't handle NULLs)
ALTER TABLE gatepass.marketing_stats DROP CONSTRAINT IF EXISTS marketing_stats_event_id_utm_source_utm_medium_utm_campaig_key;

-- 2. Create a proper unique index that handles NULLs by using COALESCE
CREATE UNIQUE INDEX IF NOT EXISTS marketing_stats_utm_unique_idx ON gatepass.marketing_stats (
    event_id, 
    utm_source, 
    COALESCE(utm_medium, ''), 
    COALESCE(utm_campaign, '')
);

-- 3. Track Event (Views/Checkouts)
CREATE OR REPLACE FUNCTION gatepass.track_marketing_event(
    p_event_id UUID,
    p_utm_source TEXT DEFAULT 'direct',
    p_utm_medium TEXT DEFAULT NULL,
    p_utm_campaign TEXT DEFAULT NULL,
    p_event_type TEXT DEFAULT 'view' -- 'view' or 'checkout'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = gatepass, public
AS $$
BEGIN
    INSERT INTO gatepass.marketing_stats (
        event_id, 
        utm_source, 
        utm_medium, 
        utm_campaign, 
        views, 
        checkouts,
        last_viewed_at
    )
    VALUES (
        p_event_id, 
        COALESCE(p_utm_source, 'direct'), 
        p_utm_medium, 
        p_utm_campaign, 
        CASE WHEN p_event_type = 'view' THEN 1 ELSE 0 END,
        CASE WHEN p_event_type = 'checkout' THEN 1 ELSE 0 END,
        NOW()
    )
    ON CONFLICT (event_id, utm_source, (COALESCE(utm_medium, '')), (COALESCE(utm_campaign, '')))
    DO UPDATE SET 
        views = gatepass.marketing_stats.views + (CASE WHEN p_event_type = 'view' THEN 1 ELSE 0 END),
        checkouts = gatepass.marketing_stats.checkouts + (CASE WHEN p_event_type = 'checkout' THEN 1 ELSE 0 END),
        last_viewed_at = NOW(),
        updated_at = NOW();
END;
$$;

-- 4. Track Conversion (Revenue)
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
SET search_path = gatepass, public
AS $$
BEGIN
    INSERT INTO gatepass.marketing_stats (
        event_id,
        utm_source,
        utm_medium,
        utm_campaign,
        transactions,
        revenue,
        currency,
        updated_at
    )
    VALUES (
        p_event_id,
        COALESCE(p_utm_source, 'direct'),
        p_utm_medium,
        p_utm_campaign,
        1,
        p_revenue,
        p_currency,
        NOW()
    )
    ON CONFLICT (event_id, utm_source, (COALESCE(utm_medium, '')), (COALESCE(utm_campaign, '')))
    DO UPDATE SET
        transactions = gatepass.marketing_stats.transactions + 1,
        revenue = gatepass.marketing_stats.revenue + p_revenue,
        currency = p_currency,
        updated_at = NOW();
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION gatepass.track_marketing_event(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION gatepass.track_marketing_conversion(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
