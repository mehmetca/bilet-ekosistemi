-- Sipariş numarası üretiminde eşzamanlı INSERT yarışı düzeltmesi.
--
-- Eski generate_order_number() fonksiyonu COUNT(*) + 1 kullanıyor.
-- İki sipariş aynı anda oluşturulursa ikisi de aynı sayıyı okuyup aynı order_number
-- üretebiliyor ve şu hata oluşuyor:
-- duplicate key value violates unique constraint "orders_order_number_key"
--
-- Bu migration sadece DB fonksiyonunu güvenli hale getirir; checkout UI akışına dokunmaz.

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  v_date_part TEXT;
  v_sequence INT;
BEGIN
  v_date_part := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');

  -- Aynı gün için sipariş numarası üretimini transaction içinde sırala.
  PERFORM pg_advisory_xact_lock(hashtext('kurdevents_order_number:' || v_date_part));

  SELECT COUNT(*) + 1 INTO v_sequence
  FROM public.orders
  WHERE order_number LIKE v_date_part || '-%';

  RETURN v_date_part || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_order_number()
  IS 'Sipariş numarası üretir; eşzamanlı insertlerde unique ihlali olmaması için advisory lock kullanır.';
