CREATE TABLE IF NOT EXISTS gatepass.organization_team (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES gatepass.organizers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organization_team_pkey PRIMARY KEY (id),
  CONSTRAINT organization_team_organization_id_email_key UNIQUE (organization_id, email)
);

-- RLS Policies
ALTER TABLE gatepass.organization_team ENABLE ROW LEVEL SECURITY;

-- Admins can view their own team
CREATE POLICY "Admins can view team members" ON gatepass.organization_team
  FOR SELECT
  USING (
    exists (
      select 1 from gatepass.organizers
      where id = organization_team.organization_id
      and user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

-- Admins can manage team members
CREATE POLICY "Admins can manage team members" ON gatepass.organization_team
  FOR ALL
  USING (
    exists (
      select 1 from gatepass.organizers
      where id = organization_team.organization_id
      and user_id = auth.uid()
    )
  );
