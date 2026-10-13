-- Provider credentials and tracking IDs now live in gatepass.organizer_integrations.
-- Apply only after running scripts/migrate-sms-credentials.mjs.
ALTER TABLE gatepass.organizers
    DROP COLUMN IF EXISTS sms_provider,
    DROP COLUMN IF EXISTS hubtel_client_id,
    DROP COLUMN IF EXISTS hubtel_client_secret,
    DROP COLUMN IF EXISTS zend_api_key,
    DROP COLUMN IF EXISTS sms_sender_id,
    DROP COLUMN IF EXISTS meta_pixel_id,
    DROP COLUMN IF EXISTS ga4_measurement_id;
