create type activity_type as enum (
  'user_login',
  'create_event', 'update_event', 'delete_event',
  'create_ticket', 'update_ticket',
  'update_settings',
  'update_fee_structure'
);

create table if not exists gatepass.activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  actor_id uuid references auth.users(id),
  action text not null, -- using text to be flexible or map to enum
  target_type text not null, -- 'event', 'organizer', 'system'
  target_id text,
  metadata jsonb default '{}'::jsonb
);

-- RLS
alter table gatepass.activity_logs enable row level security;

-- Only admins can read logs
create policy "Admins can read logs"
on gatepass.activity_logs
for select
using (
  exists (
    select 1 from gatepass.profiles
    where id = auth.uid() and is_super_admin = true
  )
);

-- System/Server actions can insert (RLS bypassed on server side usually, but good to have)
create policy "Server can insert logs"
on gatepass.activity_logs
for insert
with check ( true );
