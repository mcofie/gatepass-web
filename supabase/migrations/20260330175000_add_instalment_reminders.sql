-- Migration: Add reminder tracking to instalment payments
ALTER TABLE gatepass.instalment_payments 
ADD COLUMN IF NOT EXISTS reminder_day_before_sent boolean DEFAULT false;

ALTER TABLE gatepass.instalment_payments 
ADD COLUMN IF NOT EXISTS reminder_due_day_sent boolean DEFAULT false;

-- Add indexes to help the cron query find upcoming payments efficiently
CREATE INDEX IF NOT EXISTS idx_instalment_payments_reminders_day_before 
ON gatepass.instalment_payments (due_at, status, reminder_day_before_sent);

CREATE INDEX IF NOT EXISTS idx_instalment_payments_reminders_due_day 
ON gatepass.instalment_payments (due_at, status, reminder_due_day_sent);

COMMENT ON COLUMN gatepass.instalment_payments.reminder_day_before_sent IS 'Whether the 24-hour reminder SMS has been sent.';
COMMENT ON COLUMN gatepass.instalment_payments.reminder_due_day_sent IS 'Whether the due-day reminder SMS has been sent.';
