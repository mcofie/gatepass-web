-- Add Paystack Subaccount Code to Organizers
alter table gatepass.organizers
add column if not exists paystack_subaccount_code text;

-- Add Bank Code (needed for Paystack API)
alter table gatepass.organizers
add column if not exists bank_code text;
