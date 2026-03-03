-- Mevcut advertisements table structure'ını kontrol et
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'advertisements' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Mevcut table'ı drop et ve yeniden oluştur
DROP TABLE IF EXISTS public.advertisements CASCADE;

-- Yeni ve doğru table oluştur
CREATE TABLE public.advertisements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT, -- target_url yerine link_url
  placement TEXT NOT NULL DEFAULT 'news_slider',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS enable
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- Önce mevcut policy'leri drop et
DROP POLICY IF EXISTS "Enable read access for all users" ON public.advertisements;
DROP POLICY IF EXISTS "Admins can manage advertisements" ON public.advertisements;

-- Policy'ler
CREATE POLICY "Enable read access for all users" ON public.advertisements
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage advertisements" ON public.advertisements
  FOR ALL USING (
    auth.jwt() -> 'role' = '"authenticated"' AND 
    auth.jwt() -> 'user_data' -> 'role' IN ('"admin"', '"controller"')
  );

-- Index'ler
CREATE INDEX idx_advertisements_placement ON public.advertisements(placement);
CREATE INDEX idx_advertisements_is_active ON public.advertisements(is_active);

-- Örnek data
INSERT INTO public.advertisements (title, image_url, link_url, placement, is_active)
VALUES 
  ('Özel İndirim', 'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/advertisements/ev4z63kk51d.jpg', '/etkinlikler', 'news_slider', true);
