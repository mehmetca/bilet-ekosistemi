-- Tickets tablosu RLS politikalarını düzelt
-- Supabase SQL Editor'da çalıştırın

-- Mevcut politikaları kontrol et
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'tickets';

-- Admin için tüm izinler veren politika
DROP POLICY IF EXISTS "Admins can manage tickets" ON tickets;

CREATE POLICY "Admins can manage tickets" ON tickets
FOR ALL USING (
  auth.jwt() ->> 'email' = 'admin@bilet-ekosistemi.com'
);

-- Herkesin biletleri görebilmesi için politika
DROP POLICY IF EXISTS "Tickets are viewable by everyone" ON tickets;

CREATE POLICY "Tickets are viewable by everyone" ON tickets
FOR SELECT USING (true);

-- Bilet satın alma işlemleri için politika
DROP POLICY IF EXISTS "Users can insert tickets" ON tickets;

CREATE POLICY "Users can insert tickets" ON tickets
FOR INSERT WITH CHECK (
  auth.jwt() ->> 'email' = 'admin@bilet-ekosistemi.com'
);

-- Test: Politikaları kontrol et
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'tickets'
ORDER BY policyname;

-- Alternatif: Geçici olarak RLS'i devre dışı bırak (test için)
-- ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;

-- Sonra tekrar etkinleştir
-- ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
