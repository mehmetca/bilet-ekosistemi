-- 2025 Yılı İçin Güncel Etkinlikler
-- Supabase Dashboard > SQL Editor'da çalıştırın

-- Önce eski etkinlikleri temizle (isteğe bağlı)
-- DELETE FROM events WHERE created_at < '2025-01-01';

-- 2025 Yılı İçin Güncel Etkinlikler
INSERT INTO public.events (
  title,
  description,
  date,
  time,
  venue,
  location,
  image_url,
  category,
  price_from
) VALUES
-- 1. Gelecek Konser
(
  'Rojda - Konseri',
  'Türkiye''nin en sevilen sanatçılarından Rojda''ın unutulmaz konser deneyimi.',
  '2025-03-15',
  '21:00',
  'Küçükçiftlik Park',
  'İstanbul',
  'https://images.unsplash.com/photo-1493225457123-6b8d4a8a0a0?w=800&h=600&fit=crop',
  'konser',
  250.00
),
-- 2. Tiyatro
(
  'Hamlet - Tiyatro Oyunu',
  'Shakespeare''ın klasik eserinin modern yorumlaması.',
  '2025-04-20',
  '19:30',
  'İstanbul Devlet Tiyatrosu',
  'İstanbul',
  'https://images.unsplash.com/photo-1503075669956-3f7a6d8a8a0?w=800&h=600&fit=crop',
  'tiyatro',
  180.00
),
-- 3. Spor Maçı
(
  'Galatasaray - Fenerbahçe Derbisi',
  'Sezonun en önemli derbi maçı.',
  '2025-05-10',
  '20:00',
  'Ali Sami Yen Stadyumu',
  'İstanbul',
  'https://images.unsplash.com/photo-1431328289415-431d5c7d7f5?w=800&h=600&fit=crop',
  'spor',
  450.00
),
-- 4. Workshop
(
  'Dijital Sanat Workshop',
  'Photoshop ve Illustrator ile dijital sanat temelleri öğrenin.',
  '2025-06-01',
  '14:00',
  'İstanbul Tasarım Merkezi',
  'İstanbul',
  'https://images.unsplash.com/photo-1560472357486-f56e5c5a8bb?w=800&h=600&fit=crop',
  'workshop',
  120.00
),
-- 5. Geçmiş Etkinlik (test için)
(
  '2024 Yılbaşı Konseri',
  'Geçmiş etkinlik test - bilet satışı kapalı olmalı.',
  '2024-12-31',
  '22:00',
  'Harbiye Kongre Merkezi',
  'Ankara',
  'https://images.unsplash.com/photo-1471473987656-c5e6d6b5f2a?w=800&h=600&fit=crop',
  'konser',
  300.00
)
ON CONFLICT DO NOTHING;

-- Eklenen etkinlikleri kontrol et
SELECT 
  id,
  title,
  date,
  venue,
  location,
  category,
  price_from,
  CASE 
    WHEN date < CURRENT_DATE THEN 'Geçmiş ❌'
    WHEN date = CURRENT_DATE THEN 'Bugün ✅'
    ELSE 'Gelecek ✅'
  END as durum
FROM public.events 
ORDER BY date ASC;

-- Her etkinlik için otomatik bilet türleri oluştur
INSERT INTO public.tickets (event_id, name, type, price, stock, sold, description)
SELECT 
  e.id,
  'Standart Bilet',
  'normal',
  e.price_from,
  100, -- Stok
  0,    -- Satılan
  'Standart giriş bileti'
FROM public.events e
WHERE NOT EXISTS (
  SELECT 1 FROM public.tickets t WHERE t.event_id = e.id
);

-- VIP bilet türleri
INSERT INTO public.tickets (event_id, name, type, price, stock, sold, description)
SELECT 
  e.id,
  'VIP Bilet',
  'vip',
  e.price_from + 50, -- VIP fiyatı
  20,  -- VIP stok daha az
  0,    -- Satılan
  'VIP giriş bileti - özel alan erişimi'
FROM public.events e
WHERE NOT EXISTS (
  SELECT 1 FROM public.tickets t WHERE t.event_id = e.id AND t.type = 'vip'
);

-- Sonuçları kontrol et
SELECT 
  e.title as etkinlik,
  COUNT(t.id) as bilet_turu_sayisi,
  SUM(t.stock) as toplam_stok,
  STRING_AGG(t.name || ' (€' || t.price || ')', ', ') as biletler
FROM public.events e
LEFT JOIN public.tickets t ON e.id = t.event_id
GROUP BY e.id, e.title
ORDER BY e.date;
