-- Kategori + Para Birimi Düzeltmesi
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- Kategoriler: sadece konser, tiyatro, stand-up, festival, diger
-- Para birimi: EUR, TL, USD seçilebilir

-- 1. Kategori constraint
UPDATE public.events SET category = 'diger' 
WHERE category NOT IN ('konser', 'tiyatro', 'stand-up', 'festival', 'diger');

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;
ALTER TABLE public.events ADD CONSTRAINT events_category_check 
  CHECK (category IN ('konser', 'tiyatro', 'stand-up', 'festival', 'diger'));

-- 2. Para birimi sütunu (EUR, TL, USD)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
UPDATE public.events SET currency = 'EUR' WHERE currency IS NULL;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_currency_check;
ALTER TABLE public.events ADD CONSTRAINT events_currency_check 
  CHECK (currency IN ('EUR', 'TL', 'USD'));

-- 3. Tur/gösteri gruplaması
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS show_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_events_show_slug ON public.events(show_slug) WHERE show_slug IS NOT NULL;
