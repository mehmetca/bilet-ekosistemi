-- Advertisements table'daki data kontrolü
SELECT id, title, image_url, link_url, placement, is_active
FROM public.advertisements 
WHERE is_active = true
ORDER BY placement, created_at DESC;

-- Image URL kontrolü
SELECT image_url, LENGTH(image_url) as url_length
FROM public.advertisements 
WHERE is_active = true;

-- RLS policy kontrolü
SELECT policyname, permissive, roles
FROM pg_policies 
WHERE tablename = 'advertisements';
