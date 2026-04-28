-- Kalıcı kategori düzeltmesi:
-- - Eski/karışık stand-up yazımlarını tek tipe çevir
-- - events_category_check kısıtını standart kategori listesiyle yeniden kur

-- 1) Mevcut veriyi normalize et
UPDATE public.events
SET category = lower(trim(category))
WHERE category IS NOT NULL;

-- Stand-up varyasyonlarını tek tipe topla
UPDATE public.events
SET category = 'stand-up'
WHERE category IN ('standup', 'stand up', 'stand_up', 'stand-up');

-- Bilinmeyen/bozuk kategori değerlerini güvenli varsayılan kategoriye çek
UPDATE public.events
SET category = 'diger'
WHERE category IS NULL
   OR category NOT IN ('konser', 'tiyatro', 'stand-up', 'festival', 'diger');

-- 2) CHECK constraint'i yeniden oluştur
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_category_check;

ALTER TABLE public.events
ADD CONSTRAINT events_category_check
CHECK (category IN ('konser', 'tiyatro', 'stand-up', 'festival', 'diger'));

