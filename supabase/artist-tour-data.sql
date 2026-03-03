-- Sanatçı verisi ekle
INSERT INTO artists (name, slug, bio, tour_name, tour_start_date, tour_end_date, price_from, image_url)
VALUES (
  'Mem Ararat',
  'mem-ararat',
  'Mem Ararat, Almanya''nın en sevilen sanatçılarından. 2026 Live Turnesi ile tüm Almanya''yı coşturuyor!',
  'Live 2026',
  '2026-03-27',
  '2026-04-05',
  57.75,
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa527?w=800&h=800&fit=crop&crop=face'
)
RETURNING id;

-- Yukarıdaki sorgudan dönen ID'yi kullanarak turne etkinliklerini ekle
-- (ID'yi kopyalayıp aşağıdaki artist_id yerine yapıştırın)

INSERT INTO tour_events (artist_id, city, venue, event_date, price, ticket_url)
VALUES 
  ('BURAYA_ARTIST_ID_GELECEK', 'Berlin', 'Mercedes-Benz Arena', '2026-03-27T20:00:00', 57.75, 'https://eventim.de/event/12345'),
  ('BURAYA_ARTIST_ID_GELECEK', 'Hamburg', 'Barclaycard Arena', '2026-03-29T20:00:00', 62.50, 'https://eventim.de/event/12346'),
  ('BURAYA_ARTIST_ID_GELECEK', 'Münih', 'Olympiahalle', '2026-04-01T20:00:00', 65.00, 'https://eventim.de/event/12347'),
  ('BURAYA_ARTIST_ID_GELECEK', 'Köln', 'Lanxess Arena', '2026-04-03T20:00:00', 59.00, 'https://eventim.de/event/12348'),
  ('BURAYA_ARTIST_ID_GELECEK', 'Frankfurt', 'Festhalle', '2026-04-05T20:00:00', 61.25, 'https://eventim.de/event/12349');

-- Alternatif: Tek sorguda ekleme (ID'yi biliyorsanız)
-- Örnek: ID = '123e4567-e89b-12d3-a456-426614174000'

INSERT INTO tour_events (artist_id, city, venue, event_date, price, ticket_url)
VALUES 
  ('123e4567-e89b-12d3-a456-426614174000', 'Berlin', 'Mercedes-Benz Arena', '2026-03-27T20:00:00', 57.75, 'https://eventim.de/event/12345'),
  ('123e4567-e89b-12d3-a456-426614174000', 'Hamburg', 'Barclaycard Arena', '2026-03-29T20:00:00', 62.50, 'https://eventim.de/event/12346'),
  ('123e4567-e89b-12d3-a456-426614174000', 'Münih', 'Olympiahalle', '2026-04-01T20:00:00', 65.00, 'https://eventim.de/event/12347'),
  ('123e4567-e89b-12d3-a456-426614174000', 'Köln', 'Lanxess Arena', '2026-04-03T20:00:00', 59.00, 'https://eventim.de/event/12348'),
  ('123e4567-e89b-12d3-a456-426614174000', 'Frankfurt', 'Festhalle', '2026-04-05T20:00:00', 61.25, 'https://eventim.de/event/12349');
