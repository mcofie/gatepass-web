-- Migration: Add SMS provider configuration to organizers
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS sms_provider text DEFAULT 'none'; -- 'hubtel', 'zend', 'none'
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS hubtel_client_id text;
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS hubtel_client_secret text;
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS zend_api_key text;
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS sms_sender_id text;

-- Add comment for clarity
COMMENT ON COLUMN gatepass.organizers.sms_provider IS 'The SMS gateway provider chosen by the organizer (hubtel, zend, or none).';
