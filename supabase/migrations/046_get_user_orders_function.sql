-- Biletlerim için güvenilir sipariş sorgulama fonksiyonu
-- user_id VEYA buyer_email (eşleşme) ile siparişleri döner

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
    o.id,
    o.event_id,
    o.ticket_id,
    o.quantity,
    o.total_price,
    o.status,
    o.created_at,
    o.ticket_code,
    o.buyer_name,
    e.title AS event_title,
    e.date AS event_date,
    e.time AS event_time,
    e.venue AS event_venue,
    e.location AS event_location,
    e.currency AS event_currency,
    t.name AS ticket_name,
    t."type" AS ticket_name_type,
    t.price AS ticket_price
  FROM public.orders o
  LEFT JOIN public.events e ON e.id = o.event_id
  LEFT JOIN public.tickets t ON t.id = o.ticket_id
  WHERE
    o.user_id = p_user_id
    OR (
      p_email IS NOT NULL
      AND p_email != ''
      AND o.buyer_email IS NOT NULL
      AND LOWER(TRIM(o.buyer_email)) = LOWER(TRIM(p_email))
    )
  ORDER BY o.created_at DESC;
$$;

-- Service role için izin
GRANT EXECUTE ON FUNCTION public.get_user_orders(uuid, text) TO service_role;
