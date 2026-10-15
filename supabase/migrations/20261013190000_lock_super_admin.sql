-- Platform admin access comes only from profiles.is_super_admin, and only the platform can set it.
--  * Users could update their own profile row, including is_super_admin. A trigger now keeps that
--    column unchanged unless the change comes from the service role or a database admin.
--  * gatepass.settings policies (where that legacy table exists) matched two hardcoded emails; they now use the flag.

CREATE OR REPLACE FUNCTION gatepass.guard_super_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = gatepass, public
AS $$
BEGIN
    IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.is_super_admin := false;
    ELSIF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
        NEW.is_super_admin := OLD.is_super_admin;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_super_admin_flag ON gatepass.profiles;
CREATE TRIGGER guard_super_admin_flag
    BEFORE INSERT OR UPDATE ON gatepass.profiles
    FOR EACH ROW EXECUTE FUNCTION gatepass.guard_super_admin_flag();

-- Settings: platform admins only, by flag. The legacy gatepass.settings table only exists on
-- some databases (system_settings replaced it), so its policies are fixed only where it's present.
DO $$
BEGIN
    IF to_regclass('gatepass.settings') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Admins can view settings" ON gatepass.settings;
        DROP POLICY IF EXISTS "Admins can update settings" ON gatepass.settings;
        DROP POLICY IF EXISTS "Admins can insert settings" ON gatepass.settings;
        CREATE POLICY "Admins can view settings" ON gatepass.settings
            FOR SELECT TO authenticated USING (gatepass.check_is_super_admin());
        CREATE POLICY "Admins can update settings" ON gatepass.settings
            FOR UPDATE TO authenticated USING (gatepass.check_is_super_admin()) WITH CHECK (gatepass.check_is_super_admin());
        CREATE POLICY "Admins can insert settings" ON gatepass.settings
            FOR INSERT TO authenticated WITH CHECK (gatepass.check_is_super_admin());
    END IF;
END $$;

-- Anyone who already gave themselves the flag loses it; the two platform admins keep it.
-- Review this list before applying: it's the only place admins are named.
UPDATE gatepass.profiles
SET is_super_admin = false
WHERE is_super_admin = true
  AND lower(coalesce(email, '')) NOT IN ('maxcofie@gmail.com', 'samuel@thedsgnjunkies.com');
