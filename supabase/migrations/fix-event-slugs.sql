-- Sadece events tablosu ile çalış
-- erdal-kaya slug'ını kontrol et ve slug'ları oluştur

-- erdal-kaya slug'ını kontrol et
SELECT 
  id,
  title,
  show_slug,
  is_active,
  date,
  location
FROM public.events 
WHERE 
  is_active = true 
  AND (
    show_slug = 'erdal-kaya' OR 
    id::text = 'erdal-kaya' OR
    title ILIKE '%erdal%'
  )
ORDER BY date;

-- Shows tablosu olmadığı için events tablosundaki slug'ları oluştur
-- show_slug null olanları otomatik oluştur
UPDATE public.events 
SET show_slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(title, '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE show_slug IS NULL 
  AND is_active = true;

-- Güncelleme sonrası kontrol
SELECT 
  id,
  title,
  show_slug,
  is_active
FROM public.events 
WHERE is_active = true 
ORDER BY show_slug
LIMIT 10;

-- erdal-kaya slug'ını tekrar kontrol et
SELECT 
  id,
  title,
  show_slug,
  is_active
FROM public.events 
WHERE 
  is_active = true 
  AND show_slug = 'erdal-kaya';
