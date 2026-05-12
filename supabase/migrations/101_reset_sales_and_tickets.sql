-- ============================================================
-- VERİ SIFIRLAMA (deneme verilerini temizle)
-- ============================================================
-- AMAÇ: Test/deneme sırasında oluşan tüm satış-ve-bilet kayıtlarını sıfırlamak.
-- SİTE YAPISI VE GÖRÜNEN İÇERİK KORUNUR:
--   - events (etkinlikler), venues (mekanlar), seating_plans + sections + rows + seats (salonlar)
--   - artists (sanatçılar), cities (şehirler), news (haberler)
--   - auth.users + user_profiles + user_roles + organizer_profiles (tüm kullanıcılar)
--   - site_settings, hero_backgrounds, advertisements (içerik ayarları)
--   - Salon Yapım Wizard'da kayıtlı plan taslakları (site_settings içindeki 'salon_yapim_wizard_plan')
--
-- SİLİNECEKLER:
--   - tickets (etkinliklere bağlı tüm bilet tanımları)
--   - orders (siparişler) ve order_seats (sipariş-koltuk eşleşmeleri)
--   - seat_holds (sepetteki geçici rezervler)
--   - purchase_intents (funnel/satın alma niyetleri)
--   - event_views (etkinlik görüntülenme analitiği)
--   - event_reminders (bilet hatırlatma e-postaları)
--   - event_favorites (favorilere eklenmiş etkinlikler)
--   - artist_follows (sanatçı takipleri)
--
-- NOT: Bu migration yalnızca deneme aşamasında bir kez çalıştırılır.
-- Geri alınamaz. Yapmadan önce kritik veriniz yoksa onay verin.
--
-- YEDEK ALMA TAVSİYESİ (geri alabilmek için):
--   Supabase Dashboard → Settings → Database → Backups bölümünden bir önceki gece
--   alınan otomatik yedeği veya Manual Backup'ı kontrol edin. PITR (Point-in-time recovery)
--   açıksa istediğiniz an'a geri dönebilirsiniz. Bu SQL çalıştırılmadan önce manuel olarak
--   bir "Manual Backup" almanız önerilir.
-- ============================================================

BEGIN;

-- Önce sipariş-koltuk ilişkileri (orders'a FK)
DELETE FROM public.order_seats;

-- Tüm siparişler (kullanıcı ödemeleri, biletler)
DELETE FROM public.orders;

-- Sepet ve geçici rezervler
DELETE FROM public.seat_holds;

-- Funnel/satın alma niyetleri
DELETE FROM public.purchase_intents;

-- Etkinlik görüntülenme analitiği (deneme trafiği)
DELETE FROM public.event_views;

-- Bilet hatırlatma e-posta talepleri
DELETE FROM public.event_reminders;

-- Etkinlik favorileri
DELETE FROM public.event_favorites;

-- Sanatçı takipleri
DELETE FROM public.artist_follows;

-- En son: bilet tanımları (event_id ile bağlı; yukarıdakiler temizlenmeden silmek FK hatası verebilir)
DELETE FROM public.tickets;

COMMIT;

-- Doğrulama (sayım) — Supabase SQL Editor'da çıktıyı görmek için
SELECT
  (SELECT COUNT(*) FROM public.tickets)         AS tickets_left,
  (SELECT COUNT(*) FROM public.orders)          AS orders_left,
  (SELECT COUNT(*) FROM public.order_seats)     AS order_seats_left,
  (SELECT COUNT(*) FROM public.seat_holds)      AS seat_holds_left,
  (SELECT COUNT(*) FROM public.purchase_intents) AS purchase_intents_left,
  (SELECT COUNT(*) FROM public.event_views)     AS event_views_left,
  (SELECT COUNT(*) FROM public.event_reminders) AS event_reminders_left,
  (SELECT COUNT(*) FROM public.event_favorites) AS event_favorites_left,
  (SELECT COUNT(*) FROM public.artist_follows)  AS artist_follows_left,
  (SELECT COUNT(*) FROM public.events)          AS events_kept,
  (SELECT COUNT(*) FROM public.venues)          AS venues_kept,
  (SELECT COUNT(*) FROM public.seating_plans)   AS seating_plans_kept,
  (SELECT COUNT(*) FROM public.artists)         AS artists_kept,
  (SELECT COUNT(*) FROM public.cities)          AS cities_kept,
  (SELECT COUNT(*) FROM auth.users)             AS users_kept;
