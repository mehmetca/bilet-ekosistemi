-- Atomic ticket stock helpers used by the purchase API.

CREATE OR REPLACE FUNCTION public.reserve_ticket_stock(
  p_ticket_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_available INTEGER;
BEGIN
  IF p_ticket_id IS NULL OR p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN FALSE;
  END IF;

  SELECT available
  INTO v_available
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_available, 0) < p_quantity THEN
    RETURN FALSE;
  END IF;

  UPDATE public.tickets
  SET available = available - p_quantity,
      quantity = GREATEST(COALESCE(quantity, 0), COALESCE(available, 0))
  WHERE id = p_ticket_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ticket_stock(
  p_ticket_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_ticket_id IS NULL OR p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.tickets
  SET available = LEAST(COALESCE(quantity, available + p_quantity), available + p_quantity)
  WHERE id = p_ticket_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_ticket_stock(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ticket_stock(UUID, INTEGER) TO service_role;
