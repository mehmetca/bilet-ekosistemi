-- Mem Ararat sanatçısını oluştur
INSERT INTO artists (name, slug, bio, tour_name, tour_start_date, tour_end_date, price_from, image_url)
VALUES (
  'Mem Ararat',
  'mem-ararat',
  'Mem Ararat, Almanya''nın en sevilen sanatçılarından. 2026 Live Turnesi ile tüm Almanya''yı coşturuyor! Unutulmaz bir müzik deneyimi için biletlerinizi şimdi alın.',
  'Live 2026',
  '2026-03-27',
  '2026-04-05',
  57.75,
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa527?w=800&h=800&fit=crop&crop=face'
);

-- ID'yi almak için sorgu
SELECT id, name FROM artists WHERE slug = 'mem-ararat';

-- Yukarıdaki sorgudan dönen ID'yi kullanarak turne etkinliklerini ekle
-- Örnek ID: '123e4567-e89b-12d3-a456-426614174000' (gerçek ID'yi yukarıdan alın)

-- Turne etkinlikleri (GERÇEK ID'Yİ KULLANIN)
INSERT INTO tour_events (artist_id, city, venue, event_date, price, ticket_url)
VALUES 
  ('GERÇEK_ARTIST_ID_BURAYA', 'Berlin', 'Mercedes-Benz Arena', '2026-03-27T20:00:00', 57.75, 'https://www.eventseat.de/tr/etkinlik/ornek-mem-ararat-berlin'),
  ('GERÇEK_ARTIST_ID_BURAYA', 'Hamburg', 'Barclaycard Arena', '2026-03-29T20:00:00', 62.50, 'https://www.eventseat.de/tr/etkinlik/ornek-mem-ararat-hamburg'),
  ('GERÇEK_ARTIST_ID_BURAYA', 'Münih', 'Olympiahalle', '2026-04-01T20:00:00', 65.00, 'https://www.eventseat.de/tr/etkinlik/ornek-mem-ararat-munich'),
  ('GERÇEK_ARTIST_ID_BURAYA', 'Köln', 'Lanxess Arena', '2026-04-03T20:00:00', 59.00, 'https://www.eventseat.de/tr/etkinlik/ornek-mem-ararat-koln'),
  ('GERÇEK_ARTIST_ID_BURAYA', 'Frankfurt', 'Festhalle', '2026-04-05T20:00:00', 61.25, 'https://www.eventseat.de/tr/etkinlik/ornek-mem-ararat-frankfurt');

-- Kontrol sorguları
SELECT * FROM artists WHERE slug = 'mem-ararat';
SELECT * FROM tour_events WHERE artist_id = 'GERÇEK_ARTIST_ID_BURAYA' ORDER BY event_date;
