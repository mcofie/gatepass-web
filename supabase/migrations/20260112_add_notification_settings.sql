-- Add notification settings to organizers table
ALTER TABLE gatepass.organizers 
ADD COLUMN IF NOT EXISTS notify_on_sale BOOLEAN DEFAULT false;

-- Add notification email field (can be different from primary user email)
ALTER TABLE gatepass.organizers 
ADD COLUMN IF NOT EXISTS notification_email TEXT;
