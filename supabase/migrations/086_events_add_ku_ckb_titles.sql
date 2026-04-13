-- Events: Kurmanci ve Sorani etkinlik adı alanları
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS title_ku TEXT,
  ADD COLUMN IF NOT EXISTS title_ckb TEXT;

-- Mevcut kayıtlarda boş alanları TR başlıktan doldur
UPDATE public.events
SET
  title_ku = COALESCE(NULLIF(title_ku, ''), title_tr, title),
  title_ckb = COALESCE(NULLIF(title_ckb, ''), title_tr, title)
WHERE
  title_ku IS NULL
  OR title_ckb IS NULL;
