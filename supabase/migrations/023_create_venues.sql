-- Mekanlar (Venues) tablosu - SSS ve salon bilgileri için
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  capacity INTEGER,
  seating_layout_description TEXT,
  seating_layout_image_url TEXT,
  entrance_info TEXT,
  transport_info TEXT,
  rules TEXT,
  faq JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (etkinlik sayfasında göstermek için)
CREATE POLICY "Anyone can read venues" ON public.venues
  FOR SELECT USING (true);

-- Sadece admin/controller yönetebilir (user_roles tablosuna göre)
CREATE POLICY "Admins can manage venues" ON public.venues
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

-- Index
CREATE INDEX idx_venues_city ON public.venues(city);
CREATE INDEX idx_venues_name ON public.venues(name);
