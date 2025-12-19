-- Add platform_fee_percent to organizers table
alter table gatepass.organizers
add column if not exists platform_fee_percent double precision default null;

-- Optionally, add a check constraints if needed, but not strictly required
-- alter table gatepass.organizers add constraint ...
