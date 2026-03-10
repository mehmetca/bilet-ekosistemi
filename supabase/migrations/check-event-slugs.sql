-- Event verilerini kontrol et
-- show_slug var mı ve id'ler doğru mu?

SELECT 
  id,
  title,
  show_slug,
  is_active,
  date,
  location
FROM public.events 
WHERE is_active = true 
ORDER BY date
LIMIT 10;

-- show_slug null olanları kontrol et
SELECT 
  COUNT(*) as total_events,
  COUNT(show_slug) as events_with_slug,
  COUNT(*) - COUNT(show_slug) as events_without_slug
FROM public.events 
WHERE is_active = true;

-- Örnek event detayı
SELECT 
  id,
  title,
  show_slug,
  image_url,
  category,
  is_active
FROM public.events 
WHERE is_active = true 
LIMIT 3;
