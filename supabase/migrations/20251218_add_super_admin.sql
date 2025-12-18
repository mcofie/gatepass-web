-- Add is_super_admin column to profiles table
ALTER TABLE gatepass.profiles 
ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;

-- Create an index for faster lookups (optional but good practice)
CREATE INDEX idx_profiles_is_super_admin ON gatepass.profiles(is_super_admin);
