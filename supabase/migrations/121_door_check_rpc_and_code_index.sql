-- Kapı bilet kontrolü (Faz 1): normalize edilmiş kod anahtarı + tek turlu kontrol RPC'si.
--
-- Neden: `/kontrol` akışı bilet kodunu `.ilike('ticket_code', ...)` ile arıyor; `ilike` düz btree
-- indeksini kullanamadigi için `orders.ticket_code`'un indeksi de yokken tam tarama yapiyordu.
-- Kodlar kaydirilmissiz büyük harf üretiliyor (api/purchase/route.ts generateTicketCode) ama
-- 080_order_seats_ticket_code.sql eski koltuklara `<küçük harf md5>` eki vermiş — bu yüzden
-- `upper(ticket_code)` üzerinden sabit bir anahtar kolon gerekiyor.

-- 1) code_key: upper(ticket_code) üzerinden normalize, saklanan (stored) türetilmiş kolon.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS code_key text GENERATED ALWAYS AS (upper(ticket_code)) STORED;

ALTER TABLE public.order_seats
  ADD COLUMN IF NOT EXISTS code_key text GENERATED ALWAYS AS (upper(ticket_code)) STORED;

ALTER TABLE public.order_ticket_units
  ADD COLUMN IF NOT EXISTS code_key text GENERATED ALWAYS AS (upper(ticket_code)) STORED;

-- 2) Arama indeksi (kapıda her okuma bu kolona düşecek).
--    Unique degil: üretim geçmişi yüzünden aynı anahtara birden çok satır düşme riski var.
--    Doğrulayip unique'e çevirmek için:
--      SELECT code_key, count(*) FROM public.order_seats
--       WHERE code_key IS NOT NULL GROUP BY code_key HAVING count(*) > 1;
CREATE INDEX IF NOT EXISTS idx_orders_code_key
  ON public.orders (code_key) WHERE code_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_seats_code_key
  ON public.order_seats (code_key) WHERE code_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_ticket_units_code_key
  ON public.order_ticket_units (code_key) WHERE code_key IS NOT NULL;

COMMENT ON COLUMN public.orders.code_key IS
  'upper(ticket_code); kapı kontrol sorgularının indeksli anahtarı.';
COMMENT ON COLUMN public.order_seats.code_key IS
  'upper(ticket_code); kapı kontrol sorgularının indeksli anahtarı.';
COMMENT ON COLUMN public.order_ticket_units.code_key IS
  'upper(ticket_code); kapı kontrol sorgularının indeksli anahtarı.';

-- 3) Tek RPC: bul + (isterse) işaretle + tek turda jsonb dön.
--    UYARI: SECURITY DEFINER olduğu için RLS'i atlar. Çağıran tarafın (uygulama katmanı)
--    önce personel yetkisini ve etkinlik kapsamını doğrulaması zorunludur
--    (src/lib/server-staff-auth.ts, src/lib/controller-event-access.ts).
CREATE OR REPLACE FUNCTION public.check_ticket_door(
  p_code text,
  p_actor uuid DEFAULT NULL,
  p_mark boolean DEFAULT true,
  p_gate_id uuid DEFAULT NULL,
  p_client_event_id uuid DEFAULT NULL,
  p_allowed_event_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := upper(btrim(coalesce(p_code, '')));
  v_now timestamptz := now();
  v_kind text;
  v_ref_id uuid;
  v_order_id uuid;
  v_checked_at timestamptz;
  v_event_id uuid;
  v_status text;
  v_buyer_name text;
  v_buyer_email text;
  v_quantity integer;
  v_title text;
  v_date date;
  v_time time;
  v_location text;
  v_invalid boolean := false;
BEGIN
  IF v_key = '' THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'invalid',
      'message', 'Bilet kodu zorunludur.'
    );
  END IF;

  -- Eşleşme önceliği mevcut davranışla aynı: birim -> koltuk -> sipariş (legacy tek bilet).
  SELECT x.kind, x.ref_id, x.order_id, x.checked_at
    INTO v_kind, v_ref_id, v_order_id, v_checked_at
  FROM (
    SELECT 'unit'::text AS kind, u.id AS ref_id, u.order_id, u.checked_at
      FROM public.order_ticket_units u WHERE u.code_key = v_key
    UNION ALL
    SELECT 'seat'::text, s.id, s.order_id, s.checked_at
      FROM public.order_seats s WHERE s.code_key = v_key
    UNION ALL
    SELECT 'order'::text, o.id, o.id, o.checked_at
      FROM public.orders o WHERE o.code_key = v_key
  ) x
  ORDER BY CASE x.kind WHEN 'unit' THEN 0 WHEN 'seat' THEN 1 ELSE 2 END, x.ref_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  SELECT o.event_id, o.status, o.buyer_name, o.buyer_email, o.quantity,
         e.title, e.date, e.time, e.location
    INTO v_event_id, v_status, v_buyer_name, v_buyer_email, v_quantity,
         v_title, v_date, v_time, v_location
  FROM public.orders o
  LEFT JOIN public.events e ON e.id = o.event_id
  WHERE o.id = v_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  -- Sipariş kodu okundu ama siparişte tekil biletler var -> tekil kod okutulmalı.
  IF v_kind = 'order' AND (
       EXISTS (SELECT 1 FROM public.order_seats s WHERE s.order_id = v_order_id)
       OR EXISTS (SELECT 1 FROM public.order_ticket_units u WHERE u.order_id = v_order_id)
     ) THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'invalid', 'eventId', v_event_id,
      'message', 'Bu siparişte her bilet için ayrı kod var. Lütfen tekil bilet kodunu okutun.'
    );
  END IF;

  IF v_checked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'used', 'eventId', v_event_id,
      'message', 'Bu bilet daha önce kullanılmıştır.',
      'eventTitle', v_title, 'eventDate', v_date, 'eventTime', v_time,
      'venue', v_location,
      'buyerName', coalesce(v_buyer_name, 'Bilinmiyor'),
      'buyerEmail', coalesce(v_buyer_email, 'Bilinmiyor'),
      'quantity', 1,
      'previous', jsonb_build_object('at', v_checked_at, 'actor', NULL, 'gate', NULL)
    );
  END IF;

  IF v_status IS DISTINCT FROM 'confirmed' AND v_status IS DISTINCT FROM 'completed' THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'invalid', 'eventId', v_event_id,
      'message', 'Bilet onaylanmamış'
    );
  END IF;

  IF v_date IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'invalid', 'eventId', v_event_id,
      'message', 'Etkinlik tarihi tanımlı değil'
    );
  END IF;

  -- Saat dilimi: sunucu UTC ise 'date + time' UTC okunur; önceki sunucu tarafı
  -- `new Date(`${date} ${time}`)` davranışıyla aynı yorum.
  v_invalid := (v_date + coalesce(v_time, time '23:59'))::timestamptz < v_now;
  IF v_invalid THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'invalid', 'eventId', v_event_id,
      'message', 'Etkinlik tarihi geçmiş'
    );
  END IF;

  IF p_mark THEN
    -- Yetki kümesi uygulama katmanında kurulur (admin = NULL, kontrolör = görev listesi,
    -- organizatör = kendi etkinlikleri); burada yalnızca üyelik denetlenir.
    IF p_allowed_event_ids IS NOT NULL
       AND NOT coalesce(v_event_id = ANY(p_allowed_event_ids), false) THEN
      RETURN jsonb_build_object(
        'valid', true, 'marked', false, 'scopeDenied', true,
        'eventId', v_event_id,
        'eventTitle', v_title, 'eventDate', v_date, 'eventTime', v_time,
        'venue', v_location,
        'buyerName', coalesce(v_buyer_name, 'Bilinmiyor'),
        'buyerEmail', coalesce(v_buyer_email, 'Bilinmiyor'),
        'quantity', CASE WHEN v_kind = 'order' THEN coalesce(v_quantity, 1) ELSE 1 END,
        'refKind', v_kind, 'refId', v_ref_id, 'codeKey', v_key
      );
    END IF;

    IF v_kind = 'unit' THEN
      UPDATE public.order_ticket_units SET checked_at = v_now
        WHERE id = v_ref_id AND checked_at IS NULL;
    ELSIF v_kind = 'seat' THEN
      UPDATE public.order_seats SET checked_at = v_now
        WHERE id = v_ref_id AND checked_at IS NULL;
    ELSE
      UPDATE public.orders SET checked_at = v_now
        WHERE id = v_ref_id AND checked_at IS NULL;
    END IF;

    IF NOT FOUND THEN
      -- Eşzamanlı ikinci okuma: CAS kaybetti, kullanılmış olarak dön.
      RETURN jsonb_build_object(
        'valid', false, 'reason', 'used', 'eventId', v_event_id,
        'message', 'Bu bilet daha önce kullanılmıştır.',
        'eventTitle', v_title, 'eventDate', v_date, 'eventTime', v_time,
        'venue', v_location,
        'buyerName', coalesce(v_buyer_name, 'Bilinmiyor'),
        'buyerEmail', coalesce(v_buyer_email, 'Bilinmiyor'),
        'quantity', 1,
        'previous', jsonb_build_object('at', NULL, 'actor', NULL, 'gate', NULL)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'eventId', v_event_id,
    'eventTitle', v_title,
    'eventDate', v_date,
    'eventTime', v_time,
    'venue', v_location,
    'buyerName', coalesce(v_buyer_name, 'Bilinmiyor'),
    'buyerEmail', coalesce(v_buyer_email, 'Bilinmiyor'),
    'quantity', CASE WHEN v_kind = 'order' THEN coalesce(v_quantity, 1) ELSE 1 END,
    'marked', p_mark,
    'refKind', v_kind,
    'refId', v_ref_id,
    'codeKey', v_key,
    'actorUserId', p_actor,
    'gateId', p_gate_id,
    'clientEventId', p_client_event_id
  );
END;
$$;

COMMENT ON FUNCTION public.check_ticket_door IS
  'Kapı bileti kontrolü: code_key ile tek indeksli eşleşme, isteğe bağlı checked_at işaretleme (CAS), tek turda jsonb sonuç. Yalnızca personel yetkisi doğrulanmış çağrılarda kullanılır.';

-- Yalnızca sunucu tarafı service_role istemcisi çağırsın; uygulama katmanında zaten
-- assertStaffFromCookies/requireRole + etkinlik kapsamı doğrulaması var.
REVOKE ALL ON FUNCTION public.check_ticket_door(text, uuid, boolean, uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ticket_door(text, uuid, boolean, uuid, uuid, uuid[]) TO service_role;
