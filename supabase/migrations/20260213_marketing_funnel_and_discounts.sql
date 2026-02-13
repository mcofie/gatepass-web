-- Add checkout tracking to marketing stats
ALTER TABLE gatepass.marketing_stats ADD COLUMN IF NOT EXISTS checkouts INTEGER DEFAULT 0;

-- Add UTM campaign link to discounts
ALTER TABLE gatepass.discounts ADD COLUMN IF NOT EXISTS linked_utm_campaign TEXT;

-- Update marketing tracking function to support different event types
CREATE OR REPLACE FUNCTION gatepass.track_marketing_event(
    p_event_id UUID,
    p_utm_source TEXT,
    p_utm_medium TEXT DEFAULT NULL,
    p_utm_campaign TEXT DEFAULT NULL,
    p_event_type TEXT DEFAULT 'view' -- 'view' or 'checkout'
)
RETURNS VOID AS $$
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
    ON CONFLICT (event_id, utm_source, COALESCE(utm_medium, ''), COALESCE(utm_campaign, ''))
    DO UPDATE SET 
        views = marketing_stats.views + (CASE WHEN p_event_type = 'view' THEN 1 ELSE 0 END),
        checkouts = marketing_stats.checkouts + (CASE WHEN p_event_type = 'checkout' THEN 1 ELSE 0 END),
        last_viewed_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
