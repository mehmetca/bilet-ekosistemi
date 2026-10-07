-- Kapı bilet kontrolü (Faz 2): tek turda kapı sayaçları + görevli kırılımı.
--
-- Neden: kapıda "kaç bilet satıldı / kaç kişi içeri girdi / kaç kaldı" ve "hangi görevli
-- kaç okuttu" bilgisi yok; events.max_tickets ve tickets.available dışındaki kapasite
-- verisi kullanılmıyor, sayımlar için ayrı istekler gerekiyordu.
--
-- Ağırlık kaynağı checked_at kolonlarıdır (orders/order_seats/order_ticket_units),
-- ticket_check_logs DEĞİL: log 122'den önceki girişleri içermez ve mükerrer/geçersiz
-- okumalar da sayıyı bozar. Log yalnızca görevli kırılımı için kullanılıyor.
-- Çıkış (exit) okutma akışı olmadığı için "içeride" ayrı bir metrik olarak döndürülmez;
-- UI'da "gelen" sayısı içerideki kişi sayısı olarak kullanılır.
--
-- SIRA: 122_ticket_check_logs.sql ÖNCE uygulanmalı (buradan ticket_check_logs okunur;
-- tablo yoksa fonksiyon oluşturulamaz → bilinçli olarak erken patlar).

CREATE OR REPLACE FUNCTION public.get_event_door_stats(
  p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN jsonb_build_object('error', 'p_event_id zorunludur.');
  END IF;

  WITH ticket_rows AS (
    -- Koltuk bazlı biletler: siparişte tekil birim yoksa sayılır (yokluk çift sayımı engeller).
    -- status::text: 059 orders.status'u enum'a çevirdi; literal karşılaştırma enum'da
    -- 'confirmed' değerini kabul etmez, bu yüzden metne çevrilir (121 de v_status: text).
    SELECT s.checked_at
    FROM public.order_seats s
    JOIN public.orders o ON o.id = s.order_id
    WHERE o.event_id = p_event_id
      AND o.status::text IN ('confirmed', 'completed')
      AND NOT EXISTS (
        SELECT 1 FROM public.order_ticket_units u WHERE u.order_id = o.id
      )

    UNION ALL

    -- Adet bazlı tekil bilet birimleri.
    SELECT u.checked_at
    FROM public.order_ticket_units u
    JOIN public.orders o ON o.id = u.order_id
    WHERE u.event_id = p_event_id
      AND o.status::text IN ('confirmed', 'completed')

    UNION ALL

    -- Legacy: tek kodlu sipariş; quantity kadar bilet, hepsi tek checked_at ile girer.
    SELECT o.checked_at
    FROM public.orders o
    CROSS JOIN LATERAL generate_series(1, greatest(coalesce(o.quantity, 1), 1)) g
    WHERE o.event_id = p_event_id
      AND o.status::text IN ('confirmed', 'completed')
      AND NOT EXISTS (SELECT 1 FROM public.order_seats s WHERE s.order_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM public.order_ticket_units u WHERE u.order_id = o.id)
  ),
  agg AS (
    SELECT
      count(*) AS expected,
      count(*) FILTER (WHERE checked_at IS NOT NULL) AS arrived,
      max(checked_at) AS last_checked_at
    FROM ticket_rows
  ),
  logs AS (
    -- GROUP BY yok → log hiç olmasa bile tek satır döner (çakışan CROSS JOIN'i korur).
    SELECT max(l.scanned_at) FILTER (WHERE l.result = 'ok') AS last_ok_at
    FROM public.ticket_check_logs l
    WHERE l.event_id = p_event_id
  ),
  ops AS (
    -- Dış agregasyon GROUP BY'süz: görevli kaydı yoksa da tek satır, operators = [].
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId', actor_user_id,
          'name', actor_name,
          'ok', ok_count,
          'duplicate', dup_count,
          'invalid', invalid_count,
          'lastAt', last_at
        )
        ORDER BY ok_count DESC, last_at DESC
      ),
      '[]'::jsonb
    ) AS operators
    FROM (
      SELECT l.actor_user_id,
             public.staff_display_name(l.actor_user_id) AS actor_name,
             count(*) FILTER (WHERE l.result = 'ok') AS ok_count,
             count(*) FILTER (WHERE l.result = 'duplicate') AS dup_count,
             count(*) FILTER (WHERE l.result = 'invalid') AS invalid_count,
             max(l.scanned_at) AS last_at
      FROM public.ticket_check_logs l
      WHERE l.event_id = p_event_id
      GROUP BY l.actor_user_id
    ) t
  )
  SELECT jsonb_build_object(
    'eventId', p_event_id,
    'expected', a.expected,
    'arrived', a.arrived,
    'remaining', greatest(a.expected - a.arrived, 0),
    'lastAt', greatest(a.last_checked_at, lg.last_ok_at),
    'operators', coalesce(o.operators, '[]'::jsonb)
  )
    INTO v_result
  FROM agg a
  CROSS JOIN logs lg
  CROSS JOIN ops o;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_event_door_stats IS
  'Kapı sayaçları: beklenen(gelen+içeride dahil)/gelen/kalan bilet birimi, son okuma anı ve görevli kırılımı. Sayım checked_at üzerinden, görevli kırılımı ticket_check_logs üzerinden.';

REVOKE ALL ON FUNCTION public.get_event_door_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_door_stats(uuid) TO service_role;
