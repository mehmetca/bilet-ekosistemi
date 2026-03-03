-- Hızlı Debug - Etkinlikleri Kontrol Et
-- Supabase SQL Editor'da çalıştırın

-- 1. Tablo var mı?
SELECT 
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE tablename = 'events';

-- 2. Tablo yapısı
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'events'
ORDER BY ordinal_position;

-- 3. RLS Politikaları
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
WHERE tablename = 'events';

-- 4. Basit sorgu
SELECT COUNT(*) as etkinlik_sayisi FROM events;

-- 5. İlk 3 etkinlik
SELECT 
  id,
  title,
  date,
  venue,
  created_at
FROM events 
ORDER BY created_at DESC
LIMIT 3;

-- 6. Tarih formatı kontrolü
SELECT 
  title,
  date,
  TO_CHAR(date, 'DD.MM.YYYY') as formatli_tarih,
  EXTRACT(YEAR FROM date) as yil,
  EXTRACT(MONTH FROM date) as ay,
  EXTRACT(DAY FROM date) as gun
FROM events 
ORDER BY date;
