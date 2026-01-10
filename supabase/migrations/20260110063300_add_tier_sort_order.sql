-- Add sort_order column to ticket_tiers table for custom ordering

ALTER TABLE gatepass.ticket_tiers 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Set initial sort order based on current price order for existing tiers
WITH ordered_tiers AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY price ASC) as rn
    FROM gatepass.ticket_tiers
)
UPDATE gatepass.ticket_tiers t
SET sort_order = o.rn
FROM ordered_tiers o
WHERE t.id = o.id;

COMMENT ON COLUMN gatepass.ticket_tiers.sort_order IS 'Display order for ticket tiers (lower numbers shown first)';
