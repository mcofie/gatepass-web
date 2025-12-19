-- Add foreign key to profiles for easier joining in the frontend
-- This helps PostgREST understand how to join organization_team with profiles

-- Handle the foreign key shift with a safe drop/add
ALTER TABLE gatepass.organization_team 
DROP CONSTRAINT IF EXISTS organization_team_user_id_fkey,
DROP CONSTRAINT IF EXISTS organization_team_user_id_profiles_fkey;

ALTER TABLE gatepass.organization_team
ADD CONSTRAINT organization_team_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES gatepass.profiles(id)
ON DELETE SET NULL;

-- 1. Create a SECURITY DEFINER function to break recursion
-- This function runs with the privileges of the creator (bypass RLS)
-- but captures the current user's identity via auth.uid() and auth.jwt()
CREATE OR REPLACE FUNCTION gatepass.is_organization_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = gatepass, public
AS $$
BEGIN
    RETURN EXISTS (
        -- Is Owner
        SELECT 1 FROM gatepass.organizers 
        WHERE id = org_id AND user_id = auth.uid()
    ) OR EXISTS (
        -- Is Team Member
        SELECT 1 FROM gatepass.organization_team 
        WHERE organization_id = org_id AND email = auth.jwt() ->> 'email'
    );
END;
$$;

-- 2. Simplified Profile Access
-- Allows owners to see profiles of their team members without extra joins
DROP POLICY IF EXISTS "Organizers can view team profiles" ON gatepass.profiles;
CREATE POLICY "Organizers can view team profiles" ON gatepass.profiles
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id -- Can see own
        OR 
        EXISTS (
            SELECT 1 FROM gatepass.organization_team ot
            JOIN gatepass.organizers o ON ot.organization_id = o.id
            WHERE ot.user_id = gatepass.profiles.id
            AND o.user_id = auth.uid()
        )
    );

-- 3. Fixed Organization Team Policy
-- Uses the SECURITY DEFINER function to check access without recursion
DROP POLICY IF EXISTS "Team members can view their organization team" ON gatepass.organization_team;
CREATE POLICY "Team members can view their organization team" ON gatepass.organization_team
    FOR SELECT
    TO authenticated
    USING (
        gatepass.is_organization_member(organization_id)
    );
