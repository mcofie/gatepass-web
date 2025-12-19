-- Add username column to profiles table if it doesn't exist
ALTER TABLE gatepass.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create an index for faster lookups by username
CREATE INDEX IF NOT EXISTS idx_profiles_username ON gatepass.profiles(username);
