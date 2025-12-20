-- Create a new storage bucket for user profiles
insert into storage.buckets (id, name, public)
values ('profiles', 'profiles', true)
on conflict (id) do nothing;

-- Set up security policies

-- 1. Allow public read access to all files
drop policy if exists "Public Access Profiles" on storage.objects;
create policy "Public Access Profiles"
  on storage.objects for select
  using ( bucket_id = 'profiles' );

-- 2. Allow authenticated users to upload files
drop policy if exists "Authenticated Upload Profiles" on storage.objects;
create policy "Authenticated Upload Profiles"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'profiles' );

-- 3. Allow users to update/delete their own files
drop policy if exists "User Update Own Profiles" on storage.objects;
create policy "User Update Own Profiles"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'profiles' );

drop policy if exists "User Delete Own Profiles" on storage.objects;
create policy "User Delete Own Profiles"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'profiles' );
