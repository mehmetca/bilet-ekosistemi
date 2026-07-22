-- Eski "haberler slider" kayıtlarını ana slider'a taşı
UPDATE public.advertisements
SET placement = 'main_slider'
WHERE placement = 'news_slider';
