-- Add affiliate email support to discounts table
ALTER TABLE gatepass.discounts ADD COLUMN IF NOT EXISTS affiliate_email TEXT;
ALTER TABLE gatepass.discounts ADD COLUMN IF NOT EXISTS affiliate_commission_percent NUMERIC DEFAULT 10;
ALTER TABLE gatepass.discounts ADD COLUMN IF NOT EXISTS notify_affiliate_on_sale BOOLEAN DEFAULT TRUE;

-- Update existing marketing tracking function to support attribution by discount code if needed
-- (Though we'll handle this in the app layer for more flexibility)
