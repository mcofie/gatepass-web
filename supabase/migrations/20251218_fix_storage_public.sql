-- Force the event-media bucket to be public
-- This fixes issues where the bucket might have been created as private (default) and 'on conflict do nothing' skipped setting it to public.
UPDATE storage.buckets
SET public = true
WHERE id = 'event-media';

-- Ensure the policy allows public access (in case it was missed)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'event-media' );
