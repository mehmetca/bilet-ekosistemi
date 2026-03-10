-- RLS: En güvenli yapı
-- 1) Etkinlikleri herkes görebilsin (public read)
-- 2) Bilet türleri (tickets) silinemesin; okuma herkese açık kalsın
-- 3) Siparişler (orders) = kullanıcının biletleri: sadece kendi siparişlerini görsün

-- ========== EVENTS: Public readable ==========
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read events" ON public.events;
CREATE POLICY "Public events readable"
  ON public.events
  FOR SELECT
  USING (true);

-- (Admin/Organizer INSERT/UPDATE/DELETE politikaları 043 ve 037'de tanımlı; dokunmuyoruz.)

-- ========== TICKETS: Okuma herkese, silme yok ==========
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Bilet türü satırlarının silinmesini RLS ile kapatıyoruz
DROP POLICY IF EXISTS "Organizer can delete tickets for own events" ON public.tickets;
CREATE POLICY "No delete"
  ON public.tickets
  FOR DELETE
  USING (false);
-- Okuma: 035'te "Anyone can read tickets" var; etkinlik sayfası için gerekli
-- Gerekirse isimlendirme: Public tickets readable
DROP POLICY IF EXISTS "Anyone can read tickets" ON public.tickets;
CREATE POLICY "Public tickets readable"
  ON public.tickets
  FOR SELECT
  USING (true);

-- ========== ORDERS: Kullanıcı sadece kendi biletlerini (siparişlerini) görsün ==========
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Eski policy isimleri farklı olabilir; hedef: user_id veya buyer_email ile kendi kayıtları
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders by buyer_email" ON public.orders;

CREATE POLICY "Users can view their own tickets"
  ON public.orders
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      user_id IS NULL
      AND buyer_email IS NOT NULL
      AND LOWER(TRIM(buyer_email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', '')))
    )
  );

-- INSERT/UPDATE/DELETE: 009_fix_orders_rls_final ve Admins can manage politikaları kalır (dokunulmadı).
