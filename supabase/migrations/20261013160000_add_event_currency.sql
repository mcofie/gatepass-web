-- One currency per event; ticket types inherit it. Backfilled from each event's existing tickets.
ALTER TABLE gatepass.events ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GHS';

UPDATE gatepass.events e
SET currency = sub.currency
FROM (
    SELECT DISTINCT ON (event_id) event_id, upper(currency) AS currency
    FROM gatepass.ticket_tiers
    WHERE currency IS NOT NULL
    ORDER BY event_id, created_at
) sub
WHERE sub.event_id = e.id;
