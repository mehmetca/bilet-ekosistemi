-- Tablo kontrolü
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'hero_backgrounds';

-- Eğer tablo varsa structure'ı göster
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'hero_backgrounds' 
ORDER BY ordinal_position;
