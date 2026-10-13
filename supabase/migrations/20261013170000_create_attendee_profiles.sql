-- Attendee profiles: details guests choose to share with the organizers of events they attend,
-- so organizers can plan for them (dietary and access needs, interests, where they're from).
-- Kept apart from gatepass.profiles, which also holds account and admin fields.

CREATE TABLE IF NOT EXISTS gatepass.attendee_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone text CHECK (char_length(phone) <= 32),
    city text CHECK (char_length(city) <= 80),
    country text CHECK (char_length(country) <= 80),
    birthday date,
    bio text CHECK (char_length(bio) <= 500),
    interests text[] NOT NULL DEFAULT '{}' CHECK (cardinality(interests) <= 12),
    dietary_needs text CHECK (char_length(dietary_needs) <= 200),
    accessibility_needs text CHECK (char_length(accessibility_needs) <= 300),
    instagram text CHECK (char_length(instagram) <= 60),
    x_handle text CHECK (char_length(x_handle) <= 60),
    share_with_organizers boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gatepass.attendee_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own attendee profile" ON gatepass.attendee_profiles;
CREATE POLICY "Users manage their own attendee profile" ON gatepass.attendee_profiles
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Organizers (owners and team) see a guest's profile only when the guest opted in
-- and holds a ticket to one of that organization's events.
DROP POLICY IF EXISTS "Organizers view shared attendee profiles" ON gatepass.attendee_profiles;
CREATE POLICY "Organizers view shared attendee profiles" ON gatepass.attendee_profiles
    FOR SELECT TO authenticated
    USING (
        share_with_organizers
        AND EXISTS (
            SELECT 1 FROM gatepass.tickets t
            JOIN gatepass.events e ON e.id = t.event_id
            WHERE t.user_id = attendee_profiles.user_id
            AND gatepass.is_organization_member(e.organization_id)
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON gatepass.attendee_profiles TO authenticated;
