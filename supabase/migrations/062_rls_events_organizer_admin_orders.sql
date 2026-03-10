-- RLS (kritik): Organizer sadece kendi etkinlikleri, Admin hepsini görsün. Siparişler: kullanıcı sadece kendi siparişleri.

-- ========== EVENTS: SELECT politikaları ==========
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Eski "herkes her şeyi görsün" kaldırılıyor
DROP POLICY IF EXISTS "Public events readable" ON public.events;
DROP POLICY IF EXISTS "Anyone can read events" ON public.events;

-- 1) Sitede yayında olan etkinlikler herkese (anon dahil) açık
CREATE POLICY "Public read approved events"
  ON public.events
  FOR SELECT
  USING (is_approved = true);

-- 2) Organizatör sadece kendi etkinliklerini görür (onay bekleyen / reddedilen dahil)
CREATE POLICY "Organizer can view own events"
  ON public.events
  FOR SELECT
  USING (auth.uid() = created_by_user_id);

-- 3) Admin tüm etkinlikleri görür (user_roles tablosuna göre)
CREATE POLICY "Admin can view all events"
  ON public.events
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- (INSERT/UPDATE/DELETE politikaları 037 ve 043'te tanımlı; dokunulmuyor.)

-- ========== ORDERS: Kullanıcı sadece kendi siparişleri ==========
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Mevcut "kendi siparişleri" politikasını koruyoruz; isim ve admin politikası güncellenebilir
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.orders;

CREATE POLICY "Users see only their orders"
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

-- Admin tüm siparişleri görsün (user_roles ile; JWT role güvenilir olmayabilir)
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders"
  ON public.orders
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'controller'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'controller'))
  );

-- Kullanıcı kendi siparişini oluşturabilir / güncelleyebilir (009'daki gibi; yoksa ekle)
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
CREATE POLICY "Users can update their own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);
