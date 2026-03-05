-- events tablosuna currency sütunu ekle (EUR, TL, USD)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';

-- Mevcut kayıtlar için varsayılan
UPDATE public.events SET currency = 'EUR' WHERE currency IS NULL;

-- Constraint
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_currency_check;
ALTER TABLE public.events ADD CONSTRAINT events_currency_check 
  CHECK (currency IN ('EUR', 'TL', 'USD'));
