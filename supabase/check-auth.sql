-- Authentication ve User Rolleri Kontrolü
-- Supabase SQL Editor'da çalıştırın

-- 1. Auth schema kontrolü
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes
FROM pg_tables 
WHERE schemaname = 'auth';

-- 2. Users tablosu
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'auth'
ORDER BY ordinal_position;

-- 3. User rolleri
SELECT * FROM user_roles;

-- 4. Mevcut kullanıcılar
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 5. Admin kullanıcısı var mı?
SELECT 
  'Admin Kontrolü' as kontrol,
  COUNT(*) as admin_sayisi
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';

-- 6. Controller kullanıcısı var mı?
SELECT 
  'Controller Kontrolü' as kontrol,
  COUNT(*) as controller_sayisi
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'controller';
