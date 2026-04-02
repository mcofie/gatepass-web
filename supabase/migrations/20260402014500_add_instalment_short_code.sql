-- Add short_code to instalment_reservations for cleaner SMS links
ALTER TABLE gatepass.instalment_reservations ADD COLUMN IF NOT EXISTS short_code text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_instalment_reservations_short_code ON gatepass.instalment_reservations(short_code);

-- Backfill existing records with a portion of their ID as a temporary short_code
UPDATE gatepass.instalment_reservations 
SET short_code = substring(id::text, 1, 8) 
WHERE short_code IS NULL;
