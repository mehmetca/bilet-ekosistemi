-- Tickets tablosu yapısını kontrol et ve düzelt
-- ÖNCE RLS politikalarını düzeltin!
-- Supabase SQL Editor'da çalıştırın

-- 1. ÖNCE RLS politikalarını düzelt
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

-- 2. SONRA tablo yapısını kontrol et
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tickets' 
ORDER BY ordinal_position;

-- 3. Eksik sütunları ekle (varsa hata vermez)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 100;

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS sold INTEGER DEFAULT 0;

ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 4. Varsayılan değerleri güncelle (stok ve sold NULL ise)
UPDATE tickets 
SET stock = 100 
WHERE stock IS NULL;

UPDATE tickets 
SET sold = 0 
WHERE sold IS NULL;

-- 5. Sonuçları kontrol et
SELECT 
  id,
  event_id,
  name,
  type,
  price,
  stock,
  sold,
  description,
  created_at
FROM tickets 
ORDER BY created_at DESC;

-- 6. Etkinlik başına bilet sayısını kontrol et
SELECT 
  e.title as etkinlik,
  COUNT(t.id) as bilet_sayisi,
  SUM(t.stock) as toplam_stok,
  SUM(t.sold) as toplam_satilan
FROM events e
LEFT JOIN tickets t ON e.id = t.event_id
GROUP BY e.id, e.title
ORDER BY e.created_at DESC;
