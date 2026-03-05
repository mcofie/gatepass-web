-- Add metadata JSONB column to reservations table for storing UTM parameters and other context
ALTER TABLE gatepass.reservations 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add a comment for documentation
COMMENT ON COLUMN gatepass.reservations.metadata IS 'Stores arbitrary metadata such as UTM tracking parameters, payment context, etc.';
