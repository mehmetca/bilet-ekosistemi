-- Kullanıcı Roller ve Yetki Sistemi
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- ========== Roller tablosu ==========
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'controller')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- updated_at otomatik güncelleme
CREATE TRIGGER user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ========== Row Level Security (RLS) ==========
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- user_roles tablosundaki tüm policy'leri kaldır
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', r.policyname);
  END LOOP;
END $$;

-- Policy'ler oluştur
CREATE POLICY "Kullanıcı rolleri authenticated kullanıcılar okuyabilir"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Kullanıcı rolleri admin ekleyebilir"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Kullanıcı rolleri admin güncelleyebilir"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Kullanıcı rolleri admin silebilir"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ========== Index'ler ==========
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ========== Örnek roller ==========
-- Admin kullanıcıya admin rolü ata
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@bilet-ekosistemi.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Controller kullanıcı oluştur ve rol ata (örnek)
-- Bu kullanıcıyı manuel olarak Supabase Auth'da oluşturmanız gerekebilir
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'controller'
-- FROM auth.users
-- WHERE email = 'controller@bilet-ekosistemi.com'
-- ON CONFLICT (user_id, role) DO NOTHING;

-- ========== Rol kontrol fonksiyonları ==========
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_controller(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'controller'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.user_roles 
    WHERE user_id = user_uuid 
    ORDER BY role DESC -- admin > controller
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
