-- Son Durum Kontrolü
-- Supabase SQL Editor'da çalıştırın

-- 1. Etkinlikleri kontrol et
SELECT 
  'Etkinlikler' as tablo,
  COUNT(*) as sayi,
  STRING_AGG(title || ' (' || TO_CHAR(date, 'DD.MM.YYYY') || ')', ', ' ORDER BY date) as liste
FROM events;

-- 2. Bilet türlerini kontrol et
SELECT 
  'Bilet Türleri' as tablo,
  COUNT(*) as sayi,
  STRING_AGG(name || ' (€' || price || ')', ', ' ORDER BY price) as liste
FROM tickets;

-- 3. Tarih dağılımını kontrol et
SELECT 
  'Tarih Durumu' as kategori,
  SUM(CASE WHEN date < CURRENT_DATE THEN 1 ELSE 0 END) as gecmis,
  SUM(CASE WHEN date = CURRENT_DATE THEN 1 ELSE 0 END) as bugun,
  SUM(CASE WHEN date > CURRENT_DATE THEN 1 ELSE 0 END) as gelecek
FROM events;

-- 4. Kategori dağılımı
SELECT 
  'Kategori Dağılımı' as kategori,
  category,
  COUNT(*) as sayi
FROM events
GROUP BY category
ORDER BY sayi DESC;

-- 5. Fiyat aralığı
SELECT 
  'Fiyat Analizi' as kategori,
  MIN(price_from) as en_dusuk,
  MAX(price_from) as en_yuksek,
  ROUND(AVG(price_from), 2) as ortalama
FROM events
WHERE price_from > 0;

-- 6. Stok durumu
SELECT 
  'Stok Durumu' as kategori,
  COUNT(*) as toplam_bilet_turu,
  SUM(stock) as toplam_stok,
  SUM(sold) as toplam_satilan,
  SUM(stock - sold) as kalan_stok
FROM tickets;

-- 7. En son eklenen etkinlik
SELECT 
  'Son Etkinlik' as kategori,
  title,
  date,
  venue,
  created_at
FROM events
ORDER BY created_at DESC
LIMIT 1;
