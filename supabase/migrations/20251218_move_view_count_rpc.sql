-- Move increment_event_view to public schema for consistency
DROP FUNCTION IF EXISTS gatepass.increment_event_view(UUID);

CREATE OR REPLACE FUNCTION public.increment_event_view(event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, gatepass
AS $$
BEGIN
  UPDATE gatepass.events
  SET view_count = view_count + 1
  WHERE id = event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_event_view(UUID) TO anon, authenticated, service_role;
