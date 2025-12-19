-- Fix RLS policies for system_settings to allow upserts (INSERT + UPDATE)

-- Drop the previous narrower policy
drop policy if exists "Allow update access to super admins" on gatepass.system_settings;

-- Create a comprehensive write policy for Super Admins
-- We use "FOR ALL" to cover INSERT, UPDATE, DELETE
-- (Overlaps with the separate read-only policy for SELECT, which is fine)
create policy "Allow full access to super admins"
on gatepass.system_settings
for all
using (
  exists (
    select 1 from gatepass.profiles
    where id = auth.uid() and is_super_admin = true
  )
)
with check (
  exists (
    select 1 from gatepass.profiles
    where id = auth.uid() and is_super_admin = true
  )
);
