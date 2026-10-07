-- Kapı bilet kontrolü (Faz 2): kim / ne zaman / hangi bilet / hangi sonuç kaydı.
--
-- Neden: Faz 1'de kapıda yapılan tek yazma `checked_at` idi; hangi görevlinin okuttuğu ve
-- mükerrer/geçersiz okumalar hiç kaydedilmiyordu (repoda `checked_by`/`check_log` yok).
-- Tetikçi uygun değil: mükerrer ve geçersiz okumalar UPDATE üretmediği için tetikçi çalışmaz
-- → kaydı RPC'nin kendisi yazıyor.
--
-- Log kuralı: her RED okuma (not_found / invalid / duplicate) p_mark false olsa bile yazılır;
-- BAŞARILI kayıt yalnızca giriş işaretlendiğinde yazılır — işaretlemeyen salt-okunur doğrulama
-- veride hiçbir şey değiştirmediği için "olay" sayılmaz.
--
-- Bu dosya 121'in uyguladığı public.check_ticket_door'u LOG YAZAN haliyle yeniden tanımlar
-- (imza birebir aynı: 6 parametre). 121 çalıştırılmadan tek başına çalıştırılırsa yalnızca
-- log tablosu oluşur; akış bozulmaz.

CREATE TABLE IF NOT EXISTS public.ticket_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- not_found okumalarında etkinlik bilinmez → event_id NULL kalır.
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_ref_kind TEXT CHECK (ticket_ref_kind IN ('order', 'seat', 'unit')),
  ticket_ref_id UUID,
  code_key TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Kapı (gate) modeli sonraki fazda: şimdilik yalnızca nullable kolon, FK yok.
  gate_id UUID,
  result TEXT NOT NULL CHECK (result IN ('ok', 'duplicate', 'invalid')),
  previous_log_id UUID REFERENCES public.ticket_check_logs(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'offline')),
  -- Çevrimdışı kuyruk tekrar gönderiminde (Faz 4) mükerrer satırı engelleyen anahtar.
  client_event_id UUID,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_check_logs_event
  ON public.ticket_check_logs(event_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_check_logs_actor
  ON public.ticket_check_logs(actor_user_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_check_logs_ticket
  ON public.ticket_check_logs(ticket_ref_kind, ticket_ref_id, scanned_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_check_logs_client_event
  ON public.ticket_check_logs(client_event_id) WHERE client_event_id IS NOT NULL;

COMMENT ON TABLE public.ticket_check_logs IS
  'Kapı bilet okuma günlüğü: geçerli, mükerrer ve bulunamayan/geçersiz tüm okumalar.';
COMMENT ON COLUMN public.ticket_check_logs.gate_id IS
  'Okumanın yapıldığı kapı; kapı tanımları gelene kadar NULL.';
COMMENT ON COLUMN public.ticket_check_logs.client_event_id IS
  'Çevrimdışı kuyruk idempotency anahtarı; tekrar gönderimde aynı satırı yeniden yazmayı engeller.';

ALTER TABLE public.ticket_check_logs ENABLE ROW LEVEL SECURITY;

-- Yalnızca okuma politikaları. Satırları sadece SECURITY DEFINER fonksiyonlar yazar;
-- INSERT/UPDATE/DELETE politikası bilinçli olarak yok.
DROP POLICY IF EXISTS "Admin can read all ticket check logs" ON public.ticket_check_logs;
CREATE POLICY "Admin can read all ticket check logs"
  ON public.ticket_check_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Controller can read own ticket check logs" ON public.ticket_check_logs;
CREATE POLICY "Controller can read own ticket check logs"
  ON public.ticket_check_logs FOR SELECT
  USING (actor_user_id = auth.uid());

DROP POLICY IF EXISTS "Organizer can read ticket check logs of own events" ON public.ticket_check_logs;
CREATE POLICY "Organizer can read ticket check logs of own events"
  ON public.ticket_check_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_check_logs.event_id
        AND e.created_by_user_id = auth.uid()
    )
  );

-- Görevlinin görünen adı: profil adı → e-posta → kısa id.
-- Bilinçli olarak küçük ve bağımsız: Dashboard'a tek başına yapıştırılabilsin
-- (uzun migration dosyalarının kuyruğu yapıştırırken kesiliyor).
CREATE OR REPLACE FUNCTION public.staff_display_name(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    nullif(concat_ws(' ',
      (select first_name from user_profiles where user_id = p_user_id),
      (select last_name  from user_profiles where user_id = p_user_id)), ''),
    (select email from auth.users where id = p_user_id),
    'Görevli ' || left(p_user_id::text, 8));
$$;

COMMENT ON FUNCTION public.staff_display_name IS
  'Personel görünen adı; check_ticket_door ve get_event_door_stats ortak kullanır.';

REVOKE ALL ON FUNCTION public.staff_display_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_display_name(uuid) TO service_role;

-- Log yazma tek noktada dursun: RPC içinde 5 dal aynı satırı biçiyor.
CREATE OR REPLACE FUNCTION public.log_ticket_check(
  p_event_id uuid,
  p_ticket_ref_kind text,
  p_ticket_ref_id uuid,
  p_code_key text,
  p_actor uuid,
  p_gate_id uuid,
  p_result text,
  p_previous_log_id uuid,
  p_client_event_id uuid,
  p_scanned_at timestamptz
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.ticket_check_logs
    (event_id, ticket_ref_kind, ticket_ref_id, code_key, actor_user_id, gate_id,
     result, previous_log_id, source, client_event_id, scanned_at)
  VALUES
    (p_event_id, p_ticket_ref_kind, p_ticket_ref_id, p_code_key, p_actor, p_gate_id,
     p_result, p_previous_log_id, 'online', p_client_event_id, coalesce(p_scanned_at, now()))
  -- Partial indeksi eşleştirmek için predicate yinelenmeli; aksi halde 42P10.
  ON CONFLICT (client_event_id) WHERE client_event_id IS NOT NULL DO NOTHING
  RETURNING id;
$$;

COMMENT ON FUNCTION public.log_ticket_check IS
  'ticket_check_logs tek yazım noktası; check_ticket_door ve çevrimdışı replay buradan yazar.';

-- ---------------------------------------------------------------------------
-- check_ticket_door: log yazan sürüm (121 ile aynı imza)
-- ---------------------------------------------------------------------------
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
  v_log_id uuid;
  v_prev_log_id uuid;
  v_prev_at timestamptz;
  v_prev_actor uuid;
  v_prev_gate uuid;
  v_prev_name text;
BEGIN
  IF v_key = '' THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'invalid',
      'message', 'Bilet kodu zorunludur.'
    );
  END IF;

  -- Eşleşme önceliği: birim -> koltuk -> sipariş (legacy tek bilet).
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
    SELECT public.log_ticket_check(NULL, NULL, NULL, v_key, p_actor, p_gate_id,
                                   'invalid', NULL, p_client_event_id, v_now)
      INTO v_log_id;

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

  -- Sipariş kodu okundu ama siparişte tekil biletler var → tekil kod okutulmalı.
  IF v_kind = 'order' AND (
       EXISTS (SELECT 1 FROM public.order_seats s WHERE s.order_id = v_order_id)
       OR EXISTS (SELECT 1 FROM public.order_ticket_units u WHERE u.order_id = v_order_id)
     ) THEN
    SELECT public.log_ticket_check(v_event_id, v_kind, v_ref_id, v_key, p_actor, p_gate_id,
                                   'invalid', NULL, p_client_event_id, v_now)
      INTO v_log_id;

    RETURN jsonb_build_object(
      'valid', false, 'reason', 'invalid', 'eventId', v_event_id,
      'message', 'Bu siparişte her bilet için ayrı kod var. Lütfen tekil bilet kodunu okutun.'
    );
  END IF;

  -- Zaten işaretlenmiş → kırmızı kart: ilk girişi yapan logdaki görevli/kapı bilgisiyle.
  IF v_checked_at IS NOT NULL THEN
    SELECT l.id, l.scanned_at, l.actor_user_id, l.gate_id,
           public.staff_display_name(l.actor_user_id)
      INTO v_prev_log_id, v_prev_at, v_prev_actor, v_prev_gate, v_prev_name
    FROM public.ticket_check_logs l
    WHERE l.ticket_ref_kind = v_kind AND l.ticket_ref_id = v_ref_id
      AND l.result = 'ok'
    ORDER BY l.scanned_at DESC
    LIMIT 1;

    v_prev_at := coalesce(v_prev_at, v_checked_at);

    SELECT public.log_ticket_check(v_event_id, v_kind, v_ref_id, v_key, p_actor, p_gate_id,
                                   'duplicate', v_prev_log_id, p_client_event_id, v_now)
      INTO v_log_id;

    RETURN jsonb_build_object(
      'valid', false, 'reason', 'used', 'eventId', v_event_id,
      'message', 'Bu bilet daha önce kullanılmıştır.',
      'eventTitle', v_title, 'eventDate', v_date, 'eventTime', v_time,
      'venue', v_location,
      'buyerName', coalesce(v_buyer_name, 'Bilinmiyor'),
      'buyerEmail', coalesce(v_buyer_email, 'Bilinmiyor'),
      'quantity', 1,
      'previous', jsonb_build_object(
        'at', v_prev_at, 'actor', v_prev_actor, 'actorName', v_prev_name,
        'gate', v_prev_gate, 'logId', v_prev_log_id
      )
    );
  END IF;

  IF v_status IS DISTINCT FROM 'confirmed' AND v_status IS DISTINCT FROM 'completed' THEN
    SELECT public.log_ticket_check(v_event_id, v_kind, v_ref_id, v_key, p_actor, p_gate_id,
                                   'invalid', NULL, p_client_event_id, v_now)
      INTO v_log_id;

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
  IF (v_date + coalesce(v_time, time '23:59'))::timestamptz < v_now THEN
    SELECT public.log_ticket_check(v_event_id, v_kind, v_ref_id, v_key, p_actor, p_gate_id,
                                   'invalid', NULL, p_client_event_id, v_now)
      INTO v_log_id;

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
      SELECT public.log_ticket_check(v_event_id, v_kind, v_ref_id, v_key, p_actor, p_gate_id,
                                     'duplicate', NULL, p_client_event_id, v_now)
        INTO v_log_id;

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

    SELECT public.log_ticket_check(v_event_id, v_kind, v_ref_id, v_key, p_actor, p_gate_id,
                                   'ok', NULL, p_client_event_id, v_now)
      INTO v_log_id;
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
    'logId', v_log_id,
    'actorUserId', p_actor,
    'gateId', p_gate_id,
    'clientEventId', p_client_event_id
  );
END;
$$;

COMMENT ON FUNCTION public.check_ticket_door IS
  'Kapı bileti kontrolü: code_key ile tek indeksli eşleşme, isteğe bağlı checked_at işaretleme (CAS), her okumada ticket_check_logs kaydı, tek turda jsonb sonuç. Yalnızca personel yetkisi doğrulanmış çağrılarda kullanılır.';

REVOKE ALL ON FUNCTION public.check_ticket_door(text, uuid, boolean, uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ticket_door(text, uuid, boolean, uuid, uuid, uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.log_ticket_check(uuid, text, uuid, text, uuid, uuid, text, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_ticket_check(uuid, text, uuid, text, uuid, uuid, text, uuid, uuid, timestamptz) TO service_role;
