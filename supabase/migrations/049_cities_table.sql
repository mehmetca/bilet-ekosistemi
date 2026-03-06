-- Şehir sayfaları (Eventim tarzı "Das ist los in deiner Stadt!")
-- Her şehir: slug, çok dilli ad/açıklama, hero görsel
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_tr TEXT,
  name_de TEXT,
  name_en TEXT,
  description_tr TEXT,
  description_de TEXT,
  description_en TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cities_slug ON public.cities(slug);
CREATE INDEX IF NOT EXISTS idx_cities_sort ON public.cities(sort_order);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "Anyone can read cities" ON public.cities
  FOR SELECT USING (true);

-- Sadece admin yönetebilir
CREATE POLICY "Admins can manage cities" ON public.cities
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );
