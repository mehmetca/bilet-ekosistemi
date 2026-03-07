-- Organizatörlerin etkinliklerde görünecek isimleri (Biletinial tarzı "Organizasyon Erdal Kaya")
-- 1. organizer_requests'a organization_display_name ekle
ALTER TABLE public.organizer_requests
  ADD COLUMN IF NOT EXISTS organization_display_name TEXT;

COMMENT ON COLUMN public.organizer_requests.organization_display_name IS 'Etkinliklerde görünecek organizatör/organizasyon adı (örn: Erdal Kaya)';

-- 2. organizer_profiles: Onaylanan organizatörlerin görüntülenen isimleri
CREATE TABLE IF NOT EXISTS public.organizer_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizer_profiles_user_id ON public.organizer_profiles(user_id);

COMMENT ON TABLE public.organizer_profiles IS 'Onaylanan organizatörlerin etkinliklerde görünecek isimleri';

ALTER TABLE public.organizer_profiles ENABLE ROW LEVEL SECURITY;

-- Admin tüm profilleri yönetebilir
DROP POLICY IF EXISTS "Admin can manage organizer profiles" ON public.organizer_profiles;
CREATE POLICY "Admin can manage organizer profiles" ON public.organizer_profiles
  FOR ALL
  USING ((SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') IS NOT NULL)
  WITH CHECK ((SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') IS NOT NULL);

-- Organizatör kendi profilini görüntüleyebilir
DROP POLICY IF EXISTS "Organizer can view own profile" ON public.organizer_profiles;
CREATE POLICY "Organizer can view own profile" ON public.organizer_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Herkes okuyabilir (etkinlik sayfalarında gösterim için)
DROP POLICY IF EXISTS "Public can read organizer profiles" ON public.organizer_profiles;
CREATE POLICY "Public can read organizer profiles" ON public.organizer_profiles
  FOR SELECT
  USING (true);
