-- Mem Ararat'ın ID'sini al
SELECT id, name FROM artists WHERE slug = 'mem-ararat';

-- Yukarıdaki sorgudan dönen ID'yi kullanarak turne etkinliklerini ekle
-- Örnek: ID = 'gerçek-id-buraya'

-- Turne etkinlikleri (GERÇEK ID'Yİ KULLANIN)
INSERT INTO tour_events (artist_id, city, venue, event_date, price, ticket_url)
VALUES 
  ('GERÇEK_ID_BURAYA', 'Berlin', 'Mercedes-Benz Arena', '2026-03-27T20:00:00', 57.75, 'https://eventim.de/event/mem-ararat-berlin'),
  ('GERÇEK_ID_BURAYA', 'Hamburg', 'Barclaycard Arena', '2026-03-29T20:00:00', 62.50, 'https://eventim.de/event/mem-ararat-hamburg'),
  ('GERÇEK_ID_BURAYA', 'Münih', 'Olympiahalle', '2026-04-01T20:00:00', 65.00, 'https://eventim.de/event/mem-ararat-munich'),
  ('GERÇEK_ID_BURAYA', 'Köln', 'Lanxess Arena', '2026-04-03T20:00:00', 59.00, 'https://eventim.de/event/mem-ararat-koln'),
  ('GERÇEK_ID_BURAYA', 'Frankfurt', 'Festhalle', '2026-04-05T20:00:00', 61.25, 'https://eventim.de/event/mem-ararat-frankfurt');

-- Kontrol sorguları
SELECT * FROM artists WHERE slug = 'mem-ararat';
SELECT * FROM tour_events WHERE artist_id = 'GERÇEK_ID_BURAYA' ORDER BY event_date;
