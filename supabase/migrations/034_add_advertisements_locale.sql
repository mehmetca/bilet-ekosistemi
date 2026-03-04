-- Reklamlar tablosuna dil (locale) desteği ekle
-- TR, DE, EN - her reklam belirli bir dil için veya tüm diller için (null) olabilir

ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS locale TEXT;

-- Mevcut reklamları Türkçe olarak işaretle
UPDATE public.advertisements
SET locale = 'tr'
WHERE locale IS NULL;

-- Index: locale'e göre filtreleme
CREATE INDEX IF NOT EXISTS idx_advertisements_locale ON public.advertisements(locale);

COMMENT ON COLUMN public.advertisements.locale IS 'tr, de, en - Reklamın hedeflediği dil. NULL = tüm dillerde göster';
