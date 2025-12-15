-- Create settings table for global configuration
create table if not exists gatepass.settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table gatepass.settings enable row level security;

-- Policies: Only Admins can view/update
create policy "Admins can view settings" on gatepass.settings
    for select
    using ( auth.jwt() ->> 'email' = 'maxcofie@gmail.com' or auth.jwt() ->> 'email' = 'samuel@thedsgnjunkies.com' );

create policy "Admins can update settings" on gatepass.settings
    for update
    using ( auth.jwt() ->> 'email' = 'maxcofie@gmail.com' or auth.jwt() ->> 'email' = 'samuel@thedsgnjunkies.com' );

create policy "Admins can insert settings" on gatepass.settings
    for insert
    with check ( auth.jwt() ->> 'email' = 'maxcofie@gmail.com' or auth.jwt() ->> 'email' = 'samuel@thedsgnjunkies.com' );

-- Insert default platform fee (4%)
insert into gatepass.settings (key, value)
values ('platform_fee_percent', '4')
on conflict (key) do nothing;
