-- Create Activity Logs Table
CREATE TABLE IF NOT EXISTS gatepass.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES gatepass.organizers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES gatepass.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL, -- 'event', 'ticket', 'settings', 'staff'
  entity_id uuid, -- Optional link to the entity
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);

-- Ensure correct FK pointing to Profiles (in case table already existed with auth.users)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'activity_logs_user_id_fkey' 
        AND table_name = 'activity_logs' 
        AND table_schema = 'gatepass'
    ) THEN
        ALTER TABLE gatepass.activity_logs DROP CONSTRAINT activity_logs_user_id_fkey;
    END IF;

    ALTER TABLE gatepass.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES gatepass.profiles(id)
    ON DELETE SET NULL;
END $$;

-- Enable RLS
ALTER TABLE gatepass.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins/Staff can view logs for their organization
DROP POLICY IF EXISTS "Team can view activity logs" ON gatepass.activity_logs;
CREATE POLICY "Team can view activity logs" ON gatepass.activity_logs
  FOR SELECT
  USING (
    exists (
      select 1 from gatepass.organization_team
      where organization_id = activity_logs.organization_id
      and user_id = auth.uid()
    )
    OR
    exists (
      select 1 from gatepass.organizers
      where id = activity_logs.organization_id
      and user_id = auth.uid()
    )
  );

-- Only backend (or authenticated users via server actions) can insert
-- We'll allow inserts for now if they belong to the org, but practically this will likely be done via Service Role or Server Actions effectively bypassing RLS for inserts if we use service role. 
-- However, for client-side logging (if any), we need an insert policy.
DROP POLICY IF EXISTS "Team can insert activity logs" ON gatepass.activity_logs;
CREATE POLICY "Team can insert activity logs" ON gatepass.activity_logs
  FOR INSERT
  WITH CHECK (
     exists (
      select 1 from gatepass.organization_team
      where organization_id = activity_logs.organization_id
      and user_id = auth.uid()
    )
    OR
    exists (
      select 1 from gatepass.organizers
      where id = activity_logs.organization_id
      and user_id = auth.uid()
    )
  );
