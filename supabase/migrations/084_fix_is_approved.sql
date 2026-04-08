-- is_approved alanı events tablosuna ekle (yoksa)
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;

-- Mevcut tüm etkinlikleri onaylı yap (null olanları)
UPDATE public.events 
  SET is_approved = true 
  WHERE is_approved IS NULL;

-- Onaylanmamış etkinlikler için varsayılan false
ALTER TABLE public.events 
  ALTER COLUMN is_approved SET DEFAULT true;
