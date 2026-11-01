-- 150_offline_checkin_replay.sql
-- Kapıda çevrimdışı giriş: cihaz listesinden karar + sunucuya geri yazım (mutabakat).
--
-- Neden yeni tablo yok: 122'deki ticket_check_logs `source ('online'|'offline')`,
-- `client_event_id` idempotency anahtarı ve `scanned_at` alanlarını zaten taşıyordu;
-- check_ticket_door bunları her zaman sunucu tarafında 'online' ve şimdi() ile dolduruyor.
-- Eski fonksiyonu 250 satır yeniden yazmak yerine (yapıştırma riski + online akışa
-- dokunma tehlikesi) replay sonrası log satırı tek bir güncellemeyle etiketlenir.

ALTER TABLE public.ticket_check_logs
  ADD COLUMN IF NOT EXISTS device_id text;

COMMENT ON COLUMN public.ticket_check_logs.device_id IS
  'Okumayı yapan cihazın uygulama üretimi kimliği; çevrimdışı kuyruk takibi için.';

CREATE INDEX IF NOT EXISTS idx_ticket_check_logs_offline
  ON public.ticket_check_logs(event_id, scanned_at DESC)
  WHERE source = 'offline';

-- ---------------------------------------------------------------------------
-- mark_scan_offline: çevrimdışı kuyruk satırını cihaz saatıyla etiketle
-- ---------------------------------------------------------------------------
-- check_ticket_door log satırının id'sini yalnız başarılı ('ok') sonuçta döner,
-- mükerrer/bulunamayan okumalarda döndürmez. Bu yüzden cihaz saatına çevirme o
-- satırla sınırlı; diğerleri sunucu saatında kalır ama kuyruktan geldiği
-- `client_event_id IS NOT NULL` ile her halükârda ayırt edilir.
CREATE OR REPLACE FUNCTION public.mark_scan_offline(
  p_log_id uuid,
  p_scanned_at timestamptz DEFAULT NULL,
  p_device_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ticket_check_logs
     SET source = 'offline',
         scanned_at = coalesce(p_scanned_at, scanned_at),
         device_id = coalesce(p_device_id, device_id)
   WHERE id = p_log_id
  RETURNING id;
$$;

COMMENT ON FUNCTION public.mark_scan_offline IS
  'Çevrimdışı kuyruk okumasını ticket_check_logs üzerinde cihaz saatı + offline kaynağına çevirir.';

REVOKE ALL ON FUNCTION public.mark_scan_offline(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_scan_offline(uuid, timestamptz, text) TO service_role;

-- ---------------------------------------------------------------------------
-- door_entry_manifest: tek turda etkinlik giriş listesi (çevrimdışı karar için)
-- ---------------------------------------------------------------------------
-- Neden RPC: üç ayrı tablo (birim/koltuk/sipariş) + iptal edilen siparişlerin
-- dışlanması + "sipariş kodu okundu ama tekil kodlar var" tuzağı tarayıcıdan
-- PostgREST sorgularıyla güvenli kurulamaz; tek tur ağ gecikmesini de azaltır.
CREATE OR REPLACE FUNCTION public.door_entry_manifest(
  p_event_id uuid,
  p_allowed_event_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event jsonb;
  v_entries jsonb;
  v_total integer := 0;
  v_used integer := 0;
BEGIN
  IF p_allowed_event_ids IS NOT NULL
     AND NOT coalesce(p_event_id = ANY(p_allowed_event_ids), false) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
      'id', e.id, 'title', e.title, 'date', e.date, 'time', e.time,
      'location', e.location, 'seating_plan_id', e.seating_plan_id
    )
    INTO v_event
  FROM public.events e
  WHERE e.id = p_event_id;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  WITH valid_orders AS (
    -- orders.status bir enum (059: pending|completed|cancelled); 'confirmed' diye
    -- değeri yok, bu yüzden metin karşılaştırması yapılıyor.
    SELECT o.id
    FROM public.orders o
    WHERE o.event_id = p_event_id
      AND o.status::text = 'completed'
  ), units AS (
    SELECT u.code_key AS code,
           'unit'::text AS kind,
           u.id AS ref_id,
           u.checked_at,
           NULL::text AS section_name,
           NULL::text AS row_label,
           NULL::text AS seat_label
    FROM public.order_ticket_units u
    JOIN valid_orders v ON v.id = u.order_id
    WHERE u.event_id = p_event_id AND u.code_key IS NOT NULL
  ), seats AS (
    SELECT s.code_key,
           'seat'::text,
           s.id,
           s.checked_at,
           s.section_name,
           s.row_label,
           s.seat_label
    FROM public.order_seats s
    JOIN valid_orders v ON v.id = s.order_id
    WHERE s.code_key IS NOT NULL
  ), legacy AS (
    SELECT o.code_key,
           'order'::text,
           o.id,
           o.checked_at,
           NULL::text,
           NULL::text,
           NULL::text
    FROM public.orders o
    JOIN valid_orders v ON v.id = o.id
    WHERE o.event_id = p_event_id
      AND o.code_key IS NOT NULL
      -- Tekil kodu olan siparişin kendi kodu kapıda okutulamaz (check_ticket_door da reddeder).
      AND NOT EXISTS (SELECT 1 FROM public.order_seats s WHERE s.order_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM public.order_ticket_units u WHERE u.order_id = o.id)
  ), all_entries AS (
    SELECT * FROM units
    UNION ALL
    SELECT * FROM seats
    UNION ALL
    SELECT * FROM legacy
  )
  SELECT count(*),
         count(*) FILTER (WHERE checked_at IS NOT NULL),
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'code', code,
               'kind', kind,
               'ref', ref_id,
               'used', checked_at,
               'section', section_name,
               'row', row_label,
               'seat', seat_label
             ) ORDER BY code
           ),
           '[]'::jsonb
         )
    INTO v_total, v_used, v_entries
  FROM all_entries;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'event', v_event,
    'total', coalesce(v_total, 0),
    'used', coalesce(v_used, 0),
    'entries', v_entries
  );
END;
$$;

COMMENT ON FUNCTION public.door_entry_manifest IS
  'Çevrimdışı kapı okuma listesi: geçerli bilet kodları + kullanılmış işaretleri. Alıcı adı/e-posta bilinçli olarak dışarıda — cihaz kopyası çalınsa müşteri verisi sızmasın.';

REVOKE ALL ON FUNCTION public.door_entry_manifest(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.door_entry_manifest(uuid, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
