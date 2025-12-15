-- Reduce reservation expiration time to 5 minutes
ALTER TABLE gatepass.reservations 
ALTER COLUMN expires_at SET DEFAULT (now() + '5 minutes'::interval);
