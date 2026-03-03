-- Sipariş oluşturma hatası analizi ve Supabase limit kontrolü

-- 1. Orders tablosunun yapısını kontrol et
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Orders tablosundaki RLS politikalarını kontrol et
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
WHERE tablename = 'orders';

-- 3. Anon kullanıcının orders tablosuna yazma iznini kontrol et
SELECT has_table_privilege('anon', 'public.orders', 'INSERT') as can_insert,
       has_table_privilege('anon', 'public.orders', 'SELECT') as can_select,
       has_table_privilege('anon', 'public.orders', 'UPDATE') as can_update,
       has_table_privilege('anon', 'public.orders', 'DELETE') as can_delete;

-- 4. RLS'in aktif olup olmadığını kontrol et
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class 
WHERE relname = 'orders';

-- 5. Son sipariş kayıtlarını kontrol et
SELECT * FROM public.orders 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Supabase limit kontrolü - bağlantı sayısı
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- 7. Veritabanı boyutu ve kullanım
SELECT 
  pg_database_size('postgres') as db_size_bytes,
  pg_size_pretty(pg_database_size('postgres')) as db_size_pretty;

-- 8. Orders tablosundaki son hataları kontrol et (varsa log tablosu)
-- Eğer bir log tablosu varsa kontrol et
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%log%' OR table_name LIKE '%error%');

-- 9. Test siparişi oluşturma (manuel test)
-- Bu sorguyu çalıştırmadan önce değerleri güncelleyin
-- INSERT INTO public.orders (
--   event_id, 
--   ticket_id, 
--   quantity, 
--   total_price, 
--   ticket_code, 
--   buyer_name, 
--   buyer_email, 
--   status
-- ) VALUES (
--   'test-event-id',
--   'test-ticket-id', 
--   1,
--   100.00,
--   'TEST-12345678',
--   'Test User',
--   'test@example.com',
--   'completed'
-- );

-- 10. Supabase fonksiyonlarını kontrol et
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%generate%' OR proname LIKE '%ticket%';
