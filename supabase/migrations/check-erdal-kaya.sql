-- Event verilerini kontrol et
-- erdal-kaya slug'ı var mı?

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

-- Tüm slug'ları kontrol et
SELECT 
  id,
  title,
  show_slug,
  is_active
FROM public.events 
WHERE is_active = true 
  AND show_slug IS NOT NULL
ORDER BY show_slug;

-- Slug olmayanları kontrol et
SELECT 
  id,
  title,
  show_slug,
  is_active
FROM public.events 
WHERE is_active = true 
  AND show_slug IS NULL
LIMIT 5;
