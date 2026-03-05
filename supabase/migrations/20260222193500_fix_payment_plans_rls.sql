-- Fix RLS policy for payment_plans to include organizer owners (not just team members)
DROP POLICY IF EXISTS "Authenticated users can manage payment plans" ON gatepass.payment_plans;

CREATE POLICY "Authenticated users can manage payment plans"
  ON gatepass.payment_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM gatepass.events e
      JOIN gatepass.organizers o ON e.organization_id = o.id
      WHERE e.id = payment_plans.event_id
      AND (
        o.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM gatepass.organization_team ot
          WHERE ot.organization_id = o.id
          AND ot.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gatepass.events e
      JOIN gatepass.organizers o ON e.organization_id = o.id
      WHERE e.id = payment_plans.event_id
      AND (
        o.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM gatepass.organization_team ot
          WHERE ot.organization_id = o.id
          AND ot.user_id = auth.uid()
        )
      )
    )
  );
