-- Atomic Increment for Ticket Sales
CREATE OR REPLACE FUNCTION gatepass.increment_quantity_sold(
    p_tier_id UUID,
    p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE gatepass.ticket_tiers
    SET quantity_sold = quantity_sold + p_quantity
    WHERE id = p_tier_id;
END;
$$;
