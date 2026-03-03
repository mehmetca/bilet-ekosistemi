-- Hero backgrounds table kontrolü
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'hero_backgrounds' 
AND table_schema = 'public';

-- Hero backgrounds data kontrolü
SELECT id, title, image_url, placement, is_active, sort_order
FROM public.hero_backgrounds 
ORDER BY placement, sort_order;

-- Eğer table boşsa örnek data ekle
INSERT INTO public.hero_backgrounds (title, image_url, placement, is_active, sort_order)
VALUES 
  ('Ana Sayfa Hero', 'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/hero-backgrounds/1772107721765-image3.png', 'main', true, 1),
  ('Etkinlikler Hero', 'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/hero-backgrounds/1772107721765-image3.png', 'events', true, 1)
ON CONFLICT DO NOTHING;
