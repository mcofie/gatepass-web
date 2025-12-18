-- Run this in your Supabase SQL Editor to grant yourself super admin access.

UPDATE gatepass.profiles
SET is_super_admin = TRUE
WHERE email IN ('maxcofie@gmail.com', 'samuel@thedsgnjunkies.com');

-- Verify the change
SELECT * FROM gatepass.profiles WHERE email IN ('maxcofie@gmail.com', 'samuel@thedsgnjunkies.com');
