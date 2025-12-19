create table if not exists gatepass.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed default values
insert into gatepass.system_settings (key, value)
values ('fees', '{"platform_fee_percent": 0.04, "processor_fee_percent": 0.0195}'::jsonb)
on conflict (key) do nothing;

-- Enable RLS
alter table gatepass.system_settings enable row level security;

-- Policy: Everyone can read
create policy "Allow read access to everyone"
on gatepass.system_settings
for select
using (true);

-- Policy: Only Super Admins can update
create policy "Allow update access to super admins"
on gatepass.system_settings
for update
using (
  exists (
    select 1 from gatepass.profiles
    where id = auth.uid() and is_super_admin = true
  )
);
