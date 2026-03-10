-- Organizer paneli altyapısı (var ise dokunma)
-- Gerekli: organizer_profiles, events.created_by_user_id, events.is_approved

-- 1. organizer_profiles (054'te oluşturuluyor; yoksa burada da oluşturulabilir)
CREATE TABLE IF NOT EXISTS public.organizer_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. events tablosunda organizatör ve onay alanları (037'de ekleniyor)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;

UPDATE public.events SET is_approved = true WHERE is_approved IS NULL;
