-- Migration to remove Moolre payment gateway defensively
DO $$
BEGIN
    -- Check if column exists, if not, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'gatepass' 
          AND table_name = 'events' 
          AND column_name = 'payment_gateway'
    ) THEN
        ALTER TABLE gatepass.events ADD COLUMN payment_gateway TEXT NOT NULL DEFAULT 'paystack' CHECK (payment_gateway = 'paystack');
    ELSE
        -- If it exists, update values to 'paystack' and modify check constraint
        UPDATE gatepass.events SET payment_gateway = 'paystack' WHERE payment_gateway = 'moolre';
        ALTER TABLE gatepass.events DROP CONSTRAINT IF EXISTS events_payment_gateway_check;
        ALTER TABLE gatepass.events ADD CONSTRAINT events_payment_gateway_check CHECK (payment_gateway = 'paystack');
    END IF;
END $$;
