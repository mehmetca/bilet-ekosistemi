-- Yönetim Paneli Bağlantı Kontrolü
-- Supabase SQL Editor'da çalıştırın

-- 1. Orders tablosu var mı?
SELECT 
  'Orders Tablosu' as kontrol,
  COUNT(*) as kayit_sayisi
FROM information_schema.tables 
WHERE table_name = 'orders' AND table_schema = 'public';

-- 2. Orders tablosu yapısı
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Orders tablosu içeriği
SELECT 
  id,
  total_price,
  created_at,
  buyer_name,
  ticket_code,
  status,
  checked_at
FROM public.orders 
ORDER BY created_at DESC
LIMIT 5;

-- 4. Events tablosu bağlantısı
SELECT 
  'Events-Orders Join Test' as test,
  COUNT(*) as sonuc
FROM public.events e
LEFT JOIN public.orders o ON e.id = o.event_id;

-- 5. Tickets tablosu bağlantısı
SELECT 
  'Tickets-Orders Join Test' as test,
  COUNT(*) as sonuc
FROM public.tickets t
LEFT JOIN public.orders o ON t.id = o.ticket_id;

-- 6. User roles kontrolü
SELECT 
  'User Roles' as kontrol,
  COUNT(*) as admin_sayisi
FROM public.user_roles 
WHERE role = 'admin';

-- 7. Supabase bağlantı testi
SELECT 
  'Supabase Bağlantısı' as durum,
  NOW() as sunucu_saati,
  version() as versiyon;

-- 8. RLS politikaları
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('orders', 'events', 'tickets')
ORDER BY tablename, policyname;
