
-- Add view_count column to events table
ALTER TABLE gatepass.events 
ADD COLUMN view_count INTEGER DEFAULT 0;

-- Function to atomically increment view count
CREATE OR REPLACE FUNCTION gatepass.increment_event_view(event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE gatepass.events
  SET view_count = view_count + 1
  WHERE id = event_id;
END;
$$;

-- Grant execute permission to public/authenticated users
GRANT EXECUTE ON FUNCTION gatepass.increment_event_view(UUID) TO anon, authenticated, service_role;
