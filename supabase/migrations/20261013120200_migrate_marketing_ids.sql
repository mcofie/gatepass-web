-- Move Meta Pixel and GA4 IDs into organizer_integrations. They are public IDs, so no encryption is needed.
INSERT INTO gatepass.organizer_integrations (organizer_id, category, provider, public_config, status, is_default)
SELECT id, 'marketing', 'meta', jsonb_build_object('pixel_id', btrim(meta_pixel_id)), 'connected', false
FROM gatepass.organizers
WHERE coalesce(btrim(meta_pixel_id), '') <> ''
ON CONFLICT (organizer_id, category, provider) DO NOTHING;

INSERT INTO gatepass.organizer_integrations (organizer_id, category, provider, public_config, status, is_default)
SELECT id, 'marketing', 'ga4', jsonb_build_object('measurement_id', btrim(ga4_measurement_id)), 'connected', false
FROM gatepass.organizers
WHERE coalesce(btrim(ga4_measurement_id), '') <> ''
ON CONFLICT (organizer_id, category, provider) DO NOTHING;
