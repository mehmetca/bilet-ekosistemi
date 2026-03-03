-- Advertisements table kontrolü ve düzeltme
-- Önce table var mı kontrol et
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'advertisements' 
AND table_schema = 'public';

-- Eğer table yoksa oluştur (sort_order olmadan)
CREATE TABLE IF NOT EXISTS public.advertisements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  target_url TEXT,
  placement TEXT NOT NULL DEFAULT 'news_slider',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS enable
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- Policy'ler
DROP POLICY IF EXISTS "Enable read access for all users" ON public.advertisements;
DROP POLICY IF EXISTS "Admins can manage advertisements" ON public.advertisements;

CREATE POLICY "Enable read access for all users" ON public.advertisements
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage advertisements" ON public.advertisements
  FOR ALL USING (
    auth.jwt() -> 'role' = '"authenticated"' AND 
    auth.jwt() -> 'user_data' -> 'role' IN ('"admin"', '"controller"')
  );

-- Index'ler (sort_order olmadan)
CREATE INDEX IF NOT EXISTS idx_advertisements_placement ON public.advertisements(placement);
CREATE INDEX IF NOT EXISTS idx_advertisements_is_active ON public.advertisements(is_active);

-- Örnek data
INSERT INTO public.advertisements (title, image_url, target_url, placement, is_active)
VALUES 
  ('Özel İndirim', 'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/advertisements/ev4z63kk51d.jpg', '/etkinlikler', 'news_slider', true)
ON CONFLICT DO NOTHING;
