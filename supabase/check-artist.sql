-- Sanatçı var mı kontrol et
SELECT * FROM artists WHERE slug = 'mem-ararat';

-- Tüm sanatçıları listele
SELECT id, name, slug FROM artists;

-- Tour events var mı kontrol et
SELECT * FROM tour_events LIMIT 5;

-- Artist ID'sini bul
SELECT id, name, slug FROM artists WHERE name ILIKE '%mem%';
