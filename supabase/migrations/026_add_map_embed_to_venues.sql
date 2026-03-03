-- Google Maps embed alanı (iframe src veya tam embed kodu yapıştırılabilir)
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS map_embed_url TEXT;
