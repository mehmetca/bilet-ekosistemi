-- Önceki generate_order_number(): COUNT(*) + 1 iki eşzamanlı INSERT'te aynı sırayı üretebiliyordu
-- → UNIQUE order_number ihlali ve müşteri tarafında "duplicate key orders_order_number_key".
-- Günlük tarih için transaction-scope advisory lock ile sıralama tek iş parçacığında yapılır.

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  v_date_part TEXT;
  v_sequence INT;
  v_order_number TEXT;
BEGIN
  v_date_part := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');

  PERFORM pg_advisory_xact_lock(hashtext('kurdevents_order_number:' || v_date_part));

  SELECT COUNT(*) + 1 INTO v_sequence
  FROM public.orders
  WHERE order_number LIKE v_date_part || '-%';

  v_order_number := v_date_part || '-' || LPAD(v_sequence::TEXT, 6, '0');

  RETURN v_order_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_order_number() IS 'Sipariş numarası (DDMMYYYY-XXXXXX); eşzamanlı INSERT için advisory lock kullanır.';
