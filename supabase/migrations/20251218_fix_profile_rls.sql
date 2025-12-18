-- 1. TEMPORARILY DISABLE RLS to prevent recursion during definition
ALTER TABLE gatepass.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Create the Security Definer Function (if not exists)
CREATE OR REPLACE FUNCTION gatepass.check_is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM gatepass.profiles
    WHERE id = auth.uid()
    AND is_super_admin = true
  );
END;
$$;

-- 3. Drop existing policies to be safe
DROP POLICY IF EXISTS "Users can view own profile" ON gatepass.profiles;
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON gatepass.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON gatepass.profiles; -- Potential conflict from other migrations

-- 4. Re-create Clean Policies

-- A. Users viewing themselves
CREATE POLICY "Users can view own profile"
ON gatepass.profiles FOR SELECT
USING (auth.uid() = id);

-- B. Super Admins viewing everyone (Using the function to avoid recursion)
CREATE POLICY "Super Admins can view all profiles"
ON gatepass.profiles FOR SELECT
USING (gatepass.check_is_super_admin() = true);

-- 5. RE-ENABLE RLS
ALTER TABLE gatepass.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Ensure Max and Samuel are Super Admins (Case Insensitive)
UPDATE gatepass.profiles
SET is_super_admin = TRUE
WHERE lower(email) IN ('maxcofie@gmail.com', 'samuel@thedsgnjunkies.com');

-- Verify
SELECT email, is_super_admin FROM gatepass.profiles WHERE lower(email) IN ('maxcofie@gmail.com', 'samuel@thedsgnjunkies.com');
