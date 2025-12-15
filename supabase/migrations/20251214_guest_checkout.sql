-- Make user_id nullable in reservations
ALTER TABLE gatepass.reservations ALTER COLUMN user_id DROP NOT NULL;

-- Add guest columns to reservations
ALTER TABLE gatepass.reservations ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE gatepass.reservations ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE gatepass.reservations ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- Make user_id nullable in tickets
ALTER TABLE gatepass.tickets ALTER COLUMN user_id DROP NOT NULL;

-- RLS Policies for Guest Checkout
-- 1. Allow public inserts (Guests + Users)
DROP POLICY IF EXISTS "Allow public insert" ON gatepass.reservations;
CREATE POLICY "Allow public insert" ON gatepass.reservations FOR INSERT WITH CHECK (true);

-- 2. Allow reading reservation immediately (required for .select() return)
-- Note: In production, consider limiting this scope or moving creation to a secure Server Action.
DROP POLICY IF EXISTS "Allow public select" ON gatepass.reservations;
CREATE POLICY "Allow public select" ON gatepass.reservations FOR SELECT USING (true);

