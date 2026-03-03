-- Supabase Bağlantı ve Tablo Kontrolü
-- Supabase SQL Editor'da çalıştırın

-- 1. Bağlantı testi
SELECT 
  'Bağlantı Testi' as durum,
  NOW() as sunucu_saati,
  version() as versiyon;

-- 2. Tabloların varlığı
SELECT 
  tablename,
  tableowner,
  hasindexes
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('events', 'tickets', 'orders', 'user_roles')
ORDER BY tablename;

-- 3. Events tablosu içeriği
SELECT 
  COUNT(*) as etkinlik_sayisi,
  MAX(created_at) as son_eklenen
FROM public.events;

-- 4. Son 3 etkinlik
SELECT 
  id,
  title,
  date,
  venue,
  created_at
FROM public.events 
ORDER BY created_at DESC
LIMIT 3;

-- 5. RLS durumu
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('events', 'tickets', 'orders');

-- 6. Permission kontrolü
SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'public'
AND table_name = 'events';
