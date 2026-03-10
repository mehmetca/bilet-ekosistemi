-- Overselling önleme: Row locking + transaction ile bilet rezervasyonu
-- Aynı anda çok kişi "Satın Al" basarsa PostgreSQL aynı satırı FOR UPDATE ile kilitleyerek
-- sadece biri stok azaltıp sipariş oluşturur; diğerleri bekler veya NO_TICKETS_LEFT alır.

CREATE OR REPLACE FUNCTION public.reserve_tickets_and_create_order(
  p_ticket_id UUID,
  p_quantity INTEGER,
  p_total_price NUMERIC,
  p_ticket_code TEXT,
  p_buyer_name TEXT,
  p_buyer_email TEXT,
  p_user_id UUID DEFAULT NULL,
  p_buyer_address TEXT DEFAULT NULL,
  p_buyer_plz TEXT DEFAULT NULL,
  p_buyer_city TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INTEGER;
  v_event_id UUID;
  v_order_id UUID;
BEGIN
  -- 1) Bilet satırını kilitle (aynı ticket_id için eşzamanlı istekler sıraya girer)
  SELECT available, event_id
  INTO v_available, v_event_id
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  -- Bilet yoksa
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'TICKET_NOT_FOUND');
  END IF;

  -- 2) Stok yeterli mi?
  IF v_available IS NULL OR v_available < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_TICKETS_LEFT', 'available', COALESCE(v_available, 0));
  END IF;

  -- 3) Stok azalt
  UPDATE public.tickets
  SET available = available - p_quantity,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- 4) Sipariş oluştur
  INSERT INTO public.orders (
    event_id,
    ticket_id,
    quantity,
    total_price,
    ticket_code,
    status,
    buyer_name,
    buyer_email,
    user_id,
    buyer_address,
    buyer_plz,
    buyer_city
  ) VALUES (
    v_event_id,
    p_ticket_id,
    p_quantity,
    p_total_price,
    p_ticket_code,
    'completed',
    p_buyer_name,
    p_buyer_email,
    p_user_id,
    p_buyer_address,
    p_buyer_plz,
    p_buyer_city
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;

-- Service role / backend'den çağrılacak; güvenlik RLS ile değil uygulama katmanında
GRANT EXECUTE ON FUNCTION public.reserve_tickets_and_create_order TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_tickets_and_create_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tickets_and_create_order TO anon;

COMMENT ON FUNCTION public.reserve_tickets_and_create_order IS 'Overselling önleme: FOR UPDATE ile bilet satırını kilitleyip stok azaltır ve sipariş oluşturur.';
