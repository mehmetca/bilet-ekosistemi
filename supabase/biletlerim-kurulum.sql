-- Biletlerim bölümü - Tek seferde çalıştırın (Supabase SQL Editor)
-- 1. Sipariş sorgulama fonksiyonu
-- 2. Mevcut siparişlere user_id ata (buyer_email eşleşenler)

-- 1. Fonksiyon
CREATE OR REPLACE FUNCTION public.get_user_orders(p_user_id uuid, p_email text)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  ticket_id uuid,
  quantity INTEGER,
  total_price NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  ticket_code TEXT,
  buyer_name TEXT,
  event_title TEXT,
  event_date TEXT,
  event_time TEXT,
  event_venue TEXT,
  event_location TEXT,
  event_currency TEXT,
  ticket_name TEXT,
  ticket_name_type TEXT,
  ticket_price NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.event_id, o.ticket_id, o.quantity, o.total_price, o.status, o.created_at,
    o.ticket_code, o.buyer_name,
    e.title AS event_title, e.date AS event_date, e.time AS event_time,
    e.venue AS event_venue, e.location AS event_location, e.currency AS event_currency,
    t.name AS ticket_name, t."type" AS ticket_name_type, t.price AS ticket_price
  FROM public.orders o
  LEFT JOIN public.events e ON e.id = o.event_id
  LEFT JOIN public.tickets t ON t.id = o.ticket_id
  WHERE o.user_id = p_user_id
    OR (p_email IS NOT NULL AND p_email != '' AND o.buyer_email IS NOT NULL
        AND LOWER(TRIM(o.buyer_email)) = LOWER(TRIM(p_email)))
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_orders(uuid, text) TO service_role;

-- 2. Mevcut siparişlere user_id ata
UPDATE public.orders o
SET user_id = u.id
FROM auth.users u
WHERE o.user_id IS NULL
  AND o.buyer_email IS NOT NULL
  AND o.buyer_email != ''
  AND LOWER(TRIM(o.buyer_email)) = LOWER(TRIM(u.email));

-- 3. Bilet silme fonksiyonu (Panel'den müşteri kendi biletini silebilsin)
CREATE OR REPLACE FUNCTION public.delete_my_order(
  p_order_id uuid, p_user_id uuid, p_email text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_order RECORD; v_deleted boolean := false;
BEGIN
  SELECT id, user_id, buyer_email, ticket_id, quantity INTO v_order
  FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sipariş bulunamadı');
  END IF;
  IF v_order.user_id = p_user_id THEN v_deleted := true;
  ELSIF p_email IS NOT NULL AND p_email != '' AND v_order.buyer_email IS NOT NULL
    AND LOWER(TRIM(v_order.buyer_email)) = LOWER(TRIM(p_email)) THEN v_deleted := true;
  END IF;
  IF NOT v_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu siparişe erişim yetkiniz yok');
  END IF;
  IF v_order.ticket_id IS NOT NULL AND v_order.quantity > 0 THEN
    UPDATE public.tickets t SET available = LEAST(COALESCE(t.quantity,0), COALESCE(t.available,0) + v_order.quantity)
    WHERE t.id = v_order.ticket_id;
  END IF;
  DELETE FROM public.orders WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_order(uuid, uuid, text) TO service_role;
