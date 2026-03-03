-- Yeni etkinlikler için otomatik bilet türleri oluşturma
-- Supabase SQL Editor'da çalıştırın

-- Etkinlikleri kontrol et
SELECT 
  e.id as event_id,
  e.title as event_title,
  COUNT(t.id) as ticket_count
FROM events e
LEFT JOIN tickets t ON e.id = t.event_id
GROUP BY e.id, e.title
HAVING COUNT(t.id) = 0
ORDER BY e.created_at DESC;

-- Her etkinlik için varsayılan bilet türleri oluştur
INSERT INTO tickets (event_id, name, type, price, stock, sold, description)
SELECT 
  e.id,
  'Standart Bilet',
  'normal',
  CASE 
    WHEN e.price_from > 0 THEN e.price_from
    ELSE 25.00
  END,
  100, -- Varsayılan stok
  0,    -- Satılan adet
  'Standart giriş bileti'
FROM events e
WHERE NOT EXISTS (
  SELECT 1 FROM tickets t WHERE t.event_id = e.id
);

-- VIP bilet türleri oluştur (fiyat 50€ daha yüksek)
INSERT INTO tickets (event_id, name, type, price, stock, sold, description)
SELECT 
  e.id,
  'VIP Bilet',
  'vip',
  CASE 
    WHEN e.price_from > 0 THEN e.price_from + 50.00
    ELSE 75.00
  END,
  20,  -- VIP stok daha az
  0,    -- Satılan adet
  'VIP giriş bileti - özel alan erişimi'
FROM events e
WHERE NOT EXISTS (
  SELECT 1 FROM tickets t WHERE t.event_id = e.id AND t.type = 'vip'
);

-- Sonuçları kontrol et
SELECT 
  e.title as etkinlik,
  t.name as bilet_adi,
  t.type as tur,
  t.price as fiyat,
  t.stock as stok,
  t.sold as satilan
FROM tickets t
JOIN events e ON t.event_id = e.id
ORDER BY e.title, t.type;

-- Örnek: Belirli bir etkinlik için bilet türleri
-- Eğer belirli bir etkinlik ID'si biliyorsanız:
/*
INSERT INTO tickets (event_id, name, type, price, stock, sold, description)
VALUES 
  ('ETKINLIK_ID_BURAYA', 'Standart Bilet', 'normal', 45.00, 100, 0, 'Standart giriş bileti'),
  ('ETKINLIK_ID_BURAYA', 'VIP Bilet', 'vip', 95.00, 20, 0, 'VIP giriş bileti - özel alan erişimi');
*/
