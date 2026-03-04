-- Mekan fotoğrafları (1 veya 2 adet)
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS image_url_1 text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS image_url_2 text;
