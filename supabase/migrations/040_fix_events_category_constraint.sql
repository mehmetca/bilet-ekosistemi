-- events_category_check: konser, tiyatro, stand-up, festival, diger

-- Eski kategorileri (sinema, spor, workshop) diger'e taşı
UPDATE public.events SET category = 'diger' 
WHERE category NOT IN ('konser', 'tiyatro', 'stand-up', 'festival', 'diger');

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;

ALTER TABLE public.events ADD CONSTRAINT events_category_check 
  CHECK (category IN ('konser', 'tiyatro', 'stand-up', 'festival', 'diger'));
