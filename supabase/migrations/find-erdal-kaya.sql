-- erdal-kaya slug'ını tam kontrol et
-- events tablosunda mı yoksa başka yerde mi?

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

-- Tüm tablolarda erdal-kaya ara
-- shows tablosu
SELECT 
  id,
  title,
  slug,
  is_active
FROM public.shows 
WHERE 
  slug = 'erdal-kaya' OR 
  title ILIKE '%erdal%'
ORDER BY title;

-- events tablosunda slug olmayanları güncelle
UPDATE public.events 
SET show_slug = LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9\s]', '', 'g'))
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
