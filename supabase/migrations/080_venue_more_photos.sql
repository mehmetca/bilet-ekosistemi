-- Ek mekan görselleri (opsiyonel) - admin tarafında daha fazla foto ekleyebilmek için
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS image_url_3 text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS image_url_4 text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS image_url_5 text;

