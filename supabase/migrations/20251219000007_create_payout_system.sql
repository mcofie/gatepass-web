-- 1. Add Bank Details to Organizers
alter table gatepass.organizers
add column if not exists bank_name text,
add column if not exists account_number text,
add column if not exists account_name text;

-- 2. Create Payout Status Enum
do $$ begin
    create type gatepass.payout_status as enum ('pending', 'processing', 'paid', 'failed');
exception
    when duplicate_object then null;
end $$;

-- 3. Create Payouts Table
create table if not exists gatepass.payouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references gatepass.events(id) not null,
  organizer_id uuid references gatepass.organizers(id) not null,
  amount double precision not null,
  currency text default 'GHS',
  status gatepass.payout_status default 'pending',
  reference text,
  notes text,
  paid_at timestamptz,
  processed_by uuid references gatepass.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Enable RLS
alter table gatepass.payouts enable row level security;

-- 5. Policies
drop policy if exists "Super Admins can manage payouts" on gatepass.payouts;
create policy "Super Admins can manage payouts"
  on gatepass.payouts
  for all
  using (
    exists (select 1 from gatepass.profiles where id = auth.uid() and is_super_admin = true)
  );

drop policy if exists "Organizers can view their own payouts" on gatepass.payouts;
create policy "Organizers can view their own payouts"
  on gatepass.payouts
  for select
  using (
    organizer_id in (select id from gatepass.organizers where user_id = auth.uid())
  );

create policy "Organizers can request payouts"
  on gatepass.payouts
  for insert
  with check (
    organizer_id in (select id from gatepass.organizers where user_id = auth.uid())
  );
