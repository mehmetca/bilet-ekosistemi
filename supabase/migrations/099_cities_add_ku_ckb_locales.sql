-- Şehirler tablosuna Kurmancî (ku) ve Soranî (ckb) alanları ekler.
-- Yönetim panelinde 5 dil (TR / DE / EN / KU / CKB) için ad ve açıklama girilebilir.

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS name_ku TEXT,
  ADD COLUMN IF NOT EXISTS name_ckb TEXT,
  ADD COLUMN IF NOT EXISTS description_ku TEXT,
  ADD COLUMN IF NOT EXISTS description_ckb TEXT;

-- Mevcut kayıtlarda yeni dil alanlarını TR'den (yoksa DE/EN'den) doldur.
UPDATE public.cities
SET name_ku = COALESCE(NULLIF(name_ku, ''), name_tr, name_de, name_en)
WHERE name_ku IS NULL OR name_ku = '';

UPDATE public.cities
SET name_ckb = COALESCE(NULLIF(name_ckb, ''), name_tr, name_de, name_en)
WHERE name_ckb IS NULL OR name_ckb = '';

UPDATE public.cities
SET description_ku = COALESCE(NULLIF(description_ku, ''), description_tr, description_de, description_en)
WHERE description_ku IS NULL OR description_ku = '';

UPDATE public.cities
SET description_ckb = COALESCE(NULLIF(description_ckb, ''), description_tr, description_de, description_en)
WHERE description_ckb IS NULL OR description_ckb = '';
