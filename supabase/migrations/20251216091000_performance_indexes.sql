-- Add indexes for common lookups to improve performance

-- Discounts are looked up by event_id and code
CREATE INDEX IF NOT EXISTS idx_discounts_event_code ON gatepass.discounts(event_id, code);

-- Reservations looked up by event_id for counts
CREATE INDEX IF NOT EXISTS idx_reservations_event_id ON gatepass.reservations(event_id);

-- Tickets look up by reservation_id
CREATE INDEX IF NOT EXISTS idx_tickets_reservation_id ON gatepass.tickets(reservation_id);

-- Optimize profile lookups by user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON gatepass.profiles(id);
