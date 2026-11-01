-- 154_event_seller_binding.sql
-- Etkinlikte yazılan "Organizasyon / Organizatör adı" fatura satıcısını bağlasın.
--
-- Bugüne kadar events.seller_user_id'yi (153) hiçbir arayüz yazmıyordu: fatura ya
-- etkinlik sahibinin onaylı organizatör kaydına düşüyor, yoksa "satıcı eksik" hatası
-- veriyordu. Bu migration üç kuralı veritabanına taşıyor:
--   1) Organizatör kendi hesabından etkinlik açıyorsa satıcı = kendi onaylı kaydı.
--   2) Admin etkinlikte bir organizatör adı yazıyorsa ve bu ad onaylı TEK bir
--      organizatör kaydıyla birebir aynıysa satıcı = o organizatör.
--   3) Yazılan ad iki veya daha fazla onaylı kayıtta aynıysa bağlama yapılmaz;
--      belirsiz adı faturada satıcı olarak basmak yerine panel uyarmaya devam eder.
-- Ad eşleşmesi büyüklü-küçüklük ve boşluk farkına duyarsız; eşleşme bulunamazsa
-- alan yalnız pazarlama etiketi kalır ve fatura kesilmez (153'ün davranışı).

-- A. Tetikleyici: her INSERT/UPDATE'te satıcıyı çöz.
CREATE OR REPLACE FUNCTION public.events_resolve_seller()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_name   TEXT;
  v_count  INTEGER;
  v_seller UUID;
BEGIN
  -- 1) Açıkça seçilmiş satıcı var: UPDATE'te yalnız yazılan ad başka bir onaylı
  --    organizatöre işaret ediyorsa yeniden bağla, aksi halde dokunma.
  IF NEW.seller_user_id IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN
      v_name := NULLIF(BTRIM(COALESCE(NEW.organizer_display_name, '')), '');
      IF v_name IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.organizer_requests r
         WHERE r.user_id = NEW.seller_user_id
           AND r.status = 'approved'
           AND LOWER(BTRIM(r.company_name)) = LOWER(v_name)
      ) THEN
        SELECT COUNT(*), MIN(r.user_id::TEXT)::UUID
          INTO v_count, v_seller
          FROM public.organizer_requests r
         WHERE r.status = 'approved'
           AND r.user_id IS NOT NULL
           AND LOWER(BTRIM(r.company_name)) = LOWER(v_name);
        IF v_count = 1 THEN
          NEW.seller_user_id := v_seller;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- 2) Yazılan organizatör adı onaylı tek bir kayda denk geliyor mu?
  v_name := NULLIF(BTRIM(COALESCE(NEW.organizer_display_name, '')), '');
  IF v_name IS NOT NULL THEN
    SELECT COUNT(*), MIN(r.user_id::TEXT)::UUID
      INTO v_count, v_seller
      FROM public.organizer_requests r
     WHERE r.status = 'approved'
       AND r.user_id IS NOT NULL
       AND LOWER(BTRIM(r.company_name)) = LOWER(v_name);

    IF v_count = 1 THEN
      NEW.seller_user_id := v_seller;
      RETURN NEW;
    END IF;
  END IF;

  -- 3) Etkinlik sahibinin onaylı organizatör kaydı var mı?
  IF NEW.created_by_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizer_requests r
     WHERE r.user_id = NEW.created_by_user_id
       AND r.status = 'approved'
  ) THEN
    NEW.seller_user_id := NEW.created_by_user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_resolve_seller ON public.events;
CREATE TRIGGER trg_events_resolve_seller
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_resolve_seller();

COMMENT ON FUNCTION public.events_resolve_seller() IS
  'events.seller_user_id''yi organizatör adı / etkinlik sahibinden çözer; fatura satıcısının tek kaynağı.';

-- B. Mevcut kayıtlar için tek seferlik bağlama (ad eşleşmesi, yalnız belirsiz olmayan).
WITH named AS (
  SELECT e.id,
         COUNT(r.user_id) AS matches,
         MIN(r.user_id::TEXT)::UUID   AS seller_user_id
    FROM public.events e
    JOIN public.organizer_requests r
      ON r.status = 'approved'
     AND r.user_id IS NOT NULL
     AND LOWER(BTRIM(r.company_name)) = LOWER(BTRIM(e.organizer_display_name))
   WHERE e.seller_user_id IS NULL
     AND NULLIF(BTRIM(COALESCE(e.organizer_display_name, '')), '') IS NOT NULL
   GROUP BY e.id
)
UPDATE public.events e
   SET seller_user_id = named.seller_user_id
  FROM named
 WHERE e.id = named.id
   AND named.matches = 1
   AND e.seller_user_id IS NULL;

-- C. Etkinlik sahibinin onaylı organizatör kaydı varsa satıcı kendisi olsun.
UPDATE public.events e
   SET seller_user_id = e.created_by_user_id
 WHERE e.seller_user_id IS NULL
   AND e.created_by_user_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.organizer_requests r
      WHERE r.user_id = e.created_by_user_id
        AND r.status = 'approved'
   );

-- D. Ölçüm.
-- Not: canlı `events` tablosunda ticket_url KOLONU yok (068 bu DB'de uygulanmamış);
-- harici bilet linki açıklığın içindeki işaretten okunur:
--   description LIKE '%EVENT_EXTERNAL_TICKET_URL_START%'
-- Bu yüzden "kendi satışımız" = işaret YOK.
SELECT
  COUNT(*) FILTER (WHERE seller_user_id IS NOT NULL) AS saticisi_var,
  COUNT(*) FILTER (WHERE seller_user_id IS NULL) AS saticisi_yok,
  COUNT(*) FILTER (
    WHERE seller_user_id IS NULL
      AND description NOT LIKE '%EVENT_EXTERNAL_TICKET_URL_START%'
  ) AS kendi_satis_saticisiz
  FROM public.events;

-- D2. Satıcısı olmayan etkinlikler hangi organizatör adıyla duruyor (aksiyon listesi).
SELECT NULLIF(BTRIM(COALESCE(organizer_display_name, '')), '') AS organizator_adi,
       COUNT(*) AS etkinlik_sayisi
  FROM public.events
 WHERE seller_user_id IS NULL
 GROUP BY 1
 ORDER BY etkinlik_sayisi DESC, organizator_adi NULLS LAST
 LIMIT 30;
