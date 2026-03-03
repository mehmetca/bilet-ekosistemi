-- Advertisements RLS policy fix
-- Admin kullanıcının reklam güncellemesine izin ver

-- Mevcut policy'leri kaldır
DROP POLICY IF EXISTS "Enable read access for all users" ON public.advertisements;
DROP POLICY IF EXISTS "Admins can manage advertisements" ON public.advertisements;

-- Yeni policy'ler oluştur
CREATE POLICY "Enable read access for all users" ON public.advertisements
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage advertisements" ON public.advertisements
  FOR ALL USING (
    auth.role() = 'authenticated' AND 
    (
      auth.jwt() -> 'user_data' ->> 'role' IN ('admin', 'controller') OR
      auth.jwt() -> 'user_data' ->> 'role' = 'admin'
    )
  );

-- Test için admin kullanıcının rolünü kontrol et
SELECT 
  auth.jwt() -> 'user_data' ->> 'role' as user_role,
  auth.role() as auth_role
FROM auth.jwt()
WHERE auth.role() = 'authenticated';

-- Advertisements tablosunu kontrol et
SELECT COUNT(*) as ads_count FROM public.advertisements;
