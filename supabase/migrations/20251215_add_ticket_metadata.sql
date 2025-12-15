-- Add metadata column to tickets table for storing extra info (e.g. ticket index)
ALTER TABLE gatepass.tickets ADD COLUMN IF NOT EXISTS metadata JSONB;
