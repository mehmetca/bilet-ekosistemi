-- kurdevents.org artık WordPress değil; /wp-content/ görselleri 403 verir.
-- Yönetim panelinden Supabase Storage ile yeniden yüklenmeli.

UPDATE public.cities
SET image_url = NULL
WHERE image_url ILIKE '%kurdevents.org/wp-content/%'
   OR image_url ILIKE '%www.kurdevents.org/wp-content/%';

UPDATE public.hero_backgrounds
SET image_url = NULL
WHERE image_url ILIKE '%kurdevents.org/wp-content/%'
   OR image_url ILIKE '%www.kurdevents.org/wp-content/%';

UPDATE public.advertisements
SET image_url = NULL
WHERE image_url ILIKE '%kurdevents.org/wp-content/%'
   OR image_url ILIKE '%www.kurdevents.org/wp-content/%';

UPDATE public.events
SET image_url = NULL
WHERE image_url ILIKE '%kurdevents.org/wp-content/%'
   OR image_url ILIKE '%www.kurdevents.org/wp-content/%';

UPDATE public.news
SET image_url = NULL
WHERE image_url ILIKE '%kurdevents.org/wp-content/%'
   OR image_url ILIKE '%www.kurdevents.org/wp-content/%';
