-- Artists tablosu için RLS'i devre dışı bırak
ALTER TABLE artists DISABLE ROW LEVEL SECURITY;

-- Tour events tablosu için RLS'i devre dışı bırak
ALTER TABLE tour_events DISABLE ROW LEVEL SECURITY;

-- Kontrol et
SELECT * FROM artists WHERE slug = 'mem-ararat';
SELECT * FROM tour_events LIMIT 5;
