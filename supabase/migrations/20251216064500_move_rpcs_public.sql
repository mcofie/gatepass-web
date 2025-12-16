
-- 1. Move apply_reservation_discount to public
DROP FUNCTION IF EXISTS gatepass.apply_reservation_discount(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.apply_reservation_discount(
    p_reservation_id UUID,
    p_discount_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, gatepass
AS $$
DECLARE
    v_discount RECORD;
    v_reservation RECORD;
BEGIN
    -- 1. Fetch Reservation
    SELECT * INTO v_reservation
    FROM gatepass.reservations
    WHERE id = p_reservation_id;

    IF v_reservation.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reservation not found');
    END IF;

    -- 2. Fetch Discount
    SELECT * INTO v_discount
    FROM gatepass.discounts
    WHERE code = UPPER(p_discount_code)
      AND event_id = v_reservation.event_id;

    IF v_discount.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid discount code');
    END IF;

    -- 3. Check Limits
    IF v_discount.max_uses IS NOT NULL AND v_discount.used_count >= v_discount.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'Discount code usage limit reached');
    END IF;

    -- 4. Apply Discount
    UPDATE gatepass.reservations
    SET discount_id = v_discount.id
    WHERE id = p_reservation_id;

    RETURN jsonb_build_object(
        'success', true, 
        'discount', jsonb_build_object(
            'id', v_discount.id,
            'code', v_discount.code,
            'value', v_discount.value,
            'type', v_discount.type
        )
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_reservation_discount(UUID, TEXT) TO anon, authenticated, service_role;


-- 2. Move increment_discount_usage to public
DROP FUNCTION IF EXISTS gatepass.increment_discount_usage(UUID);

CREATE OR REPLACE FUNCTION public.increment_discount_usage(
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
    SELECT max_uses, used_count INTO v_max, v_new_count
    FROM gatepass.discounts WHERE id = p_discount_id FOR UPDATE;

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

GRANT EXECUTE ON FUNCTION public.increment_discount_usage(UUID) TO anon, authenticated, service_role;
