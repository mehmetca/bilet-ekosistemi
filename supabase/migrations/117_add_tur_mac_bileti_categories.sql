-- Yeni etkinlik kategorileri: Tur ve Maç Bileti
-- UI'da görünmeleri için mevcut CHECK kısıtına eklenmelidir.
-- Aksi halde yeni kategorili etkinlik KAYDEDİLEMEZ.

ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_category_check;

ALTER TABLE public.events
ADD CONSTRAINT events_category_check
CHECK (category IN ('konser', 'tiyatro', 'stand-up', 'festival', 'tur', 'mac-bileti', 'diger'));
