-- Add fee snapshot columns to transactions table
alter table gatepass.transactions
add column if not exists platform_fee double precision default 0,
add column if not exists applied_fee_rate double precision default 0;

-- Optional: Backfill existing transactions (Approximation using default 4% if null)
-- update gatepass.transactions set platform_fee = amount * 0.04, applied_fee_rate = 0.04 where platform_fee is null;
