-- Allow users to update their own profiles
DROP POLICY IF EXISTS "Users can update own profile" ON gatepass.profiles;
CREATE POLICY "Users can update own profile" ON gatepass.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (if not already handled by trigger)
DROP POLICY IF EXISTS "Users can insert own profile" ON gatepass.profiles;
CREATE POLICY "Users can insert own profile" ON gatepass.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);
