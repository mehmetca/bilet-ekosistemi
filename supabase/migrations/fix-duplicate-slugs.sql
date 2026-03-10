-- Duplicate slug sorununu çöz
-- Her event için unique slug oluştur

-- Önce mevcut durumu gör
SELECT 
  show_slug,
  COUNT(*) as count,
  STRING_AGG(title, ', ' ORDER BY title) as titles
FROM public.events 
WHERE is_active = true 
  AND show_slug IS NOT NULL
GROUP BY show_slug 
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Unique slug'ları oluştur (id ile ekle)
UPDATE public.events 
SET show_slug = show_slug || '-' || LEFT(id::text, 8)
WHERE is_active = true 
  AND show_slug IN (
    SELECT show_slug 
    FROM public.events 
    WHERE is_active = true 
      AND show_slug IS NOT NULL
    GROUP BY show_slug 
    HAVING COUNT(*) > 1
  );

-- Güncelleme sonrası kontrol
SELECT 
  id,
  title,
  show_slug,
  is_active
FROM public.events 
WHERE title ILIKE '%erdal%'
ORDER BY show_slug;

-- Tüm slug'ların unique olduğunu kontrol et
SELECT 
  COUNT(*) as total_events,
  COUNT(DISTINCT show_slug) as unique_slugs
FROM public.events 
WHERE is_active = true 
  AND show_slug IS NOT NULL;
