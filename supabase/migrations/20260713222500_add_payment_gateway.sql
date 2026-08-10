-- Add payment_gateway column to events table
ALTER TABLE gatepass.events 
ADD COLUMN payment_gateway TEXT NOT NULL DEFAULT 'paystack' 
CHECK (payment_gateway IN ('paystack', 'moolre'));
