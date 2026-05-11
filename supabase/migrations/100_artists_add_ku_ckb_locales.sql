-- Sanatçılar: Kurmancî (ku) ve Soranî (ckb) ad ve biyografi alanları

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS name_ku TEXT,
  ADD COLUMN IF NOT EXISTS name_ckb TEXT,
  ADD COLUMN IF NOT EXISTS bio_ku TEXT,
  ADD COLUMN IF NOT EXISTS bio_ckb TEXT;

UPDATE public.artists
SET name_ku = COALESCE(NULLIF(name_ku, ''), name_tr, name_de, name_en, name)
WHERE name_ku IS NULL OR name_ku = '';

UPDATE public.artists
SET name_ckb = COALESCE(NULLIF(name_ckb, ''), name_tr, name_de, name_en, name)
WHERE name_ckb IS NULL OR name_ckb = '';

UPDATE public.artists
SET bio_ku = COALESCE(NULLIF(bio_ku, ''), bio_tr, bio_de, bio_en, bio)
WHERE bio_ku IS NULL OR bio_ku = '';

UPDATE public.artists
SET bio_ckb = COALESCE(NULLIF(bio_ckb, ''), bio_tr, bio_de, bio_en, bio)
WHERE bio_ckb IS NULL OR bio_ckb = '';
