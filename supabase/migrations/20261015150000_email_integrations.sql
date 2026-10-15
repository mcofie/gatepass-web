-- Organizers can connect their own email provider (ticket emails go out from their domain)
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'gatepass.organizer_integrations'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%category%'
    LOOP
        EXECUTE format('ALTER TABLE gatepass.organizer_integrations DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE gatepass.organizer_integrations
    ADD CONSTRAINT organizer_integrations_category_check CHECK (category IN ('payments', 'sms', 'marketing', 'email'));
