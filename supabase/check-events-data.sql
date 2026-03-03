-- Events Tablosu Kontrolü
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- Events tablosundaki veriyi kontrol et
SELECT 
  id,
  title,
  date,
  time,
  venue,
  location,
  category,
  price_from,
  created_at
FROM public.events 
ORDER BY created_at DESC;

-- Events tablosunun varlığını kontrol et
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'events' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
