-- Seed Organizers from existing Events
DO $$
DECLARE
    r RECORD;
    org_id UUID;
    org_name TEXT;
    org_slug TEXT;
BEGIN
    -- Loop through all unique users who have created events but don't have an organization profile yet
    FOR r IN 
        SELECT DISTINCT e.organizer_id, p.full_name
        FROM gatepass.events e
        LEFT JOIN gatepass.profiles p ON e.organizer_id = p.id
        WHERE e.organization_id IS NULL
    LOOP
        -- Determine Name
        org_name := COALESCE(r.full_name, 'Organizer ' || substring(r.organizer_id::text, 1, 8));
        
        -- Generate Slug (basic)
        org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(md5(random()::text), 1, 4);

        -- Create Organizer Profile
        INSERT INTO gatepass.organizers (user_id, name, slug)
        VALUES (r.organizer_id, org_name, org_slug)
        ON CONFLICT DO NOTHING -- In case race condition
        RETURNING id INTO org_id;

        -- If logic inserted, org_id is set. If conflict (already exists), need to fetch it.
        IF org_id IS NULL THEN
            SELECT id INTO org_id FROM gatepass.organizers WHERE user_id = r.organizer_id LIMIT 1;
        END IF;

        -- Update Events for this user
        UPDATE gatepass.events
        SET organization_id = org_id
        WHERE organizer_id = r.organizer_id AND organization_id IS NULL;
        
        RAISE NOTICE 'Created organizer % for user % and linked events.', org_name, r.organizer_id;
    END LOOP;
END $$;
