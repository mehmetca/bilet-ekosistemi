-- Fix race condition in order number generation under concurrent inserts.
-- Uses a transaction-scoped advisory lock per day key so two sessions
-- cannot allocate the same order number in the same second.
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  v_date_part TEXT;
  v_sequence INT;
BEGIN
  v_date_part := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');
  PERFORM pg_advisory_xact_lock(hashtext('kurdevents_order_number:' || v_date_part));

  SELECT COALESCE(MAX(substring(order_number FROM '[0-9]+$')::int), 0) + 1
    INTO v_sequence
  FROM public.orders
  WHERE order_number LIKE v_date_part || '-%'
    AND order_number ~ ('^' || v_date_part || '-[0-9]+$');

  RETURN v_date_part || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
