-- Bilet kontrol için veritabanı kontrolü
-- BLT-EMCRMQT8 biletini ara

SELECT 
  o.id,
  o.ticket_code,
  o.quantity,
  o.buyer_name,
  o.buyer_email,
  o.status,
  o.checked_at,
  o.created_at,
  e.title as event_title,
  e.date as event_date,
  e.time as event_time,
  e.venue as event_venue,
  e.location as event_location,
  t.name as ticket_name,
  t.type as ticket_type,
  t.price as ticket_price
FROM orders o
LEFT JOIN events e ON o.event_id = e.id
LEFT JOIN tickets t ON o.ticket_id = t.id
WHERE o.ticket_code = 'BLT-EMCRMQT8';

-- Tüm siparişleri kontrol et
SELECT 
  ticket_code,
  buyer_name,
  quantity,
  checked_at,
  created_at
FROM orders 
ORDER BY created_at DESC
LIMIT 10;

-- Orders tablosu yapısı
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;
