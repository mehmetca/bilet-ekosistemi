-- Events: Sorani kısa açıklama alanı
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description_ckb TEXT;

-- Mevcut kayıtlarda boş alanları TR açıklamadan doldur
UPDATE public.events
SET description_ckb = COALESCE(NULLIF(description_ckb, ''), description_tr, description)
WHERE description_ckb IS NULL;
