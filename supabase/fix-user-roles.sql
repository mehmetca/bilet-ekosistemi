-- User Roles Tablosu Hızlı Düzeltme
-- Supabase Dashboard > SQL Editor'da bu kodu çalıştırın

-- 1. Önce tabloyu kontrol et
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'user_roles';

-- 2. Tablo yoksa oluştur
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'controller')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 3. RLS'yi devre dışı bırak (geçici çözüm)
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 4. Index'ler
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 5. Mevcut kullanıcıya rol ata (sizin kullanıcı ID'niz)
INSERT INTO public.user_roles (user_id, role)
VALUES ('6dcf7d39-6d0a-4dc0-a68e-c4008df6260e', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Test için kontrol
SELECT * FROM public.user_roles WHERE user_id = '6dcf7d39-6d0a-4dc0-a68e-c4008df6260e';
