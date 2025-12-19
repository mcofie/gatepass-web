-- Add processor fee snapshot columns to transactions table
alter table gatepass.transactions
add column if not exists applied_processor_fee double precision default 0,
add column if not exists applied_processor_rate double precision default 0;
