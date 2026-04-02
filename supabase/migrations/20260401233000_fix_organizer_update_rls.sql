-- Update RLS for organizers to allow team admins to update organization settings
DROP POLICY IF EXISTS "Users can update own organizations" ON gatepass.organizers;

CREATE POLICY "Owners and team admins can update organizations" ON gatepass.organizers
    FOR UPDATE 
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM gatepass.organization_team
            WHERE organization_id = organizers.id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    )
    WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM gatepass.organization_team
            WHERE organization_id = organizers.id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Also allow owners and team admins to SELECT their organization (though it's currently public SELECT true)
-- We'll keep the public SELECT for now as it's already there and might be needed for public event pages.
