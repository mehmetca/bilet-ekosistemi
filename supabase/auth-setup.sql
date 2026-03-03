-- Supabase Auth Kurulumu
-- Supabase Dashboard > Authentication > Settings'da bu ayarları yapın

-- NOT: Bu SQL'i çalıştırmayın, sadece referans için

-- 1. Authentication'ı enable edin
-- Dashboard > Authentication > Settings > Enable authentication

-- 2. Email/Password provider'ı enable edin
-- Dashboard > Authentication > Providers > Email > Enable

-- 3. Site URL ve Redirect URL'leri ayarlayın
-- Site URL: http://localhost:3000
-- Redirect URLs: http://localhost:3000/auth/callback

-- 4. Yönetici kullanıcıları oluşturmak için:
-- Dashboard > Authentication > Users > Add user
-- Email: admin@bilet-ekosistemi.com
-- Password: admin123
-- Mark as confirmed: YES

-- 5. RLS Policy için admin kontrolü
-- Bu fonksiyon admin kullanıcısı kontrol eder
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- auth.uid() null ise false döndür
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admin email kontrolü (production'da kullanıcı ID'si ile kontrol edilmeli)
  RETURN EXISTS(
    SELECT 1 
    FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'admin@bilet-ekosistemi.com'
  );
END;
$$;

-- Örnek admin-only policy
-- CREATE POLICY "Admin only" ON public.events
--   FOR ALL TO authenticated
--   USING (public.is_admin());
