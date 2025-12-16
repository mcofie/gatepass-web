
-- Atomic increment for discount usage
CREATE OR REPLACE FUNCTION gatepass.increment_discount_usage(
    p_discount_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, gatepass
AS $$
DECLARE
    v_new_count INT;
    v_max INT;
BEGIN
    -- Check limit first (optional, but good for safety)
    SELECT max_uses, used_count INTO v_max, v_new_count
    FROM gatepass.discounts WHERE id = p_discount_id FOR UPDATE; -- Lock row

    IF v_max IS NOT NULL AND v_new_count >= v_max THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usage limit reached');
    END IF;

    UPDATE gatepass.discounts
    SET used_count = COALESCE(used_count, 0) + 1,
        updated_at = NOW()
    WHERE id = p_discount_id
    RETURNING used_count INTO v_new_count;

    RETURN jsonb_build_object('success', true, 'new_count', v_new_count);
END;
$$;

GRANT EXECUTE ON FUNCTION gatepass.increment_discount_usage(UUID) TO service_role;
