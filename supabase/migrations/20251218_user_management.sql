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
DROP POLICY IF EXISTS "Admins can view team members" ON gatepass.organization_team;
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
DROP POLICY IF EXISTS "Admins can manage team members" ON gatepass.organization_team;
CREATE POLICY "Admins can manage team members" ON gatepass.organization_team
  FOR ALL
  USING (
    exists (
      select 1 from gatepass.organizers
      where id = organization_team.organization_id
      and user_id = auth.uid()
    )
  );

-- Update customer_stats view to include organization_id
DROP VIEW IF EXISTS "gatepass"."customer_stats";
CREATE OR REPLACE VIEW "gatepass"."customer_stats" AS
SELECT
  e.organization_id,
  COALESCE(p.email, r.guest_email) AS email,
  MAX(COALESCE(p.full_name, r.guest_name, 'Unknown')) AS name,
  MAX(COALESCE(p.phone_number, r.guest_phone)) AS phone,
  COUNT(t.id) AS tickets_bought,
  SUM(t.amount) AS total_spent,
  MAX(t.paid_at) AS last_seen
FROM "gatepass"."transactions" t
JOIN "gatepass"."reservations" r ON t.reservation_id = r.id
JOIN "gatepass"."events" e ON r.event_id = e.id
LEFT JOIN "gatepass"."profiles" p ON r.user_id = p.id
WHERE t.status = 'success'
  AND COALESCE(p.email, r.guest_email) IS NOT NULL
GROUP BY
  e.organization_id,
  COALESCE(p.email, r.guest_email);

-- Add settlement details to organizers
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE gatepass.organizers ADD COLUMN IF NOT EXISTS account_name TEXT;
