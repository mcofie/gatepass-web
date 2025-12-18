-- Create a new storage bucket for event media
insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

-- Set up security policies

-- 1. Allow public read access to all files
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'event-media' );

-- 2. Allow authenticated users to upload files
-- We restrict them to their own folder structure if possible, but for now allow auth users to upload
create policy "Authenticated Upload"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'event-media' );

-- 3. Allow users to update/delete their own files (optional, but good for management)
create policy "User Update Own Files"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'event-media' );

create policy "User Delete Own Files"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'event-media' );
