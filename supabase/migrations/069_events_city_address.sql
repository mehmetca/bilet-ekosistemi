-- Şehir ve adresi ayrı sakla; filtrede sadece şehir gösterilsin, uzun adres listeyi bozmasın.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN public.events.city IS 'Etkinlik şehri; filtreleme ve kısa gösterim için';
COMMENT ON COLUMN public.events.address IS 'Tam adres; detay sayfasında gösterilir';

-- Mevcut location değerini city veya address'e taşıma (opsiyonel): location tek parça kalabilir
-- Yeni kayıtlarda city + address set edilecek, location = city + ', ' + address ile doldurulacak
