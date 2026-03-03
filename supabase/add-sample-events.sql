-- Örnek Etkinlikler Ekle
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- Örnek etkinlikler ekle
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
(
  'Rock Festival 2024',
  'Türkiye''nin en iyi rock gruplarının sahne alacağı unutulmaz bir festival deneyimi.',
  '2024-07-15',
  '19:00',
  'Küçükçiftlik Park',
  'İstanbul',
  NULL,
  'konser',
  450.00
),
(
  'Stand-up Gecesi: Cem Yılmaz',
  'Cem Yılmaz''ın yeni gösterim programı ile kahkahaların durmak bilmeyeceği bir gece.',
  '2024-06-20',
  '20:30',
  'Zorlu PSM',
  'İstanbul',
  NULL,
  'tiyatro',
  350.00
),
(
  'Galatasaray - Fenerbahçe Derbisi',
  'Sezonun en önemli maçı, iki dev takımının kıyasıya mücadelesi.',
  '2024-05-25',
  '20:00',
  'Ali Sami Yen Stadyumu',
  'İstanbul',
  NULL,
  'spor',
  850.00
),
(
  'Yoga ve Meditasyon Atölyesi',
  'Zihinsel ve bedensel dengeyi bulmak için profesyonel yönlendirmeli yoga çalışması.',
  '2024-06-10',
  '10:00',
  'LifeCo Wellness',
  'İstanbul',
  NULL,
  'workshop',
  250.00
),
(
  'Caz Gecesi: Kerem Görsev',
  'Türkiye''nin en önemli caz piyanistlerinden romantik bir müzik akşamı.',
  '2024-08-05',
  '21:00',
  'Nardis Jazz Club',
  'İstanbul',
  NULL,
  'konser',
  280.00
),
(
  'Ankara Rock Festivali',
  'Ankara''nın en iyi rock gruplarının sahne alacağı unutulmaz bir festival deneyimi.',
  '2024-07-20',
  '19:00',
  'Ankara Açık Hava Tiyatrosu',
  'Ankara',
  NULL,
  'konser',
  480.00
),
(
  'İzmir Fuarı 2024',
  'Ege''nin en büyük ticaret ve sanat fuarı.',
  '2024-09-10',
  '10:00',
  'İzmir Fuar Alanı',
  'İzmir',
  NULL,
  'diger',
  150.00
),
(
  'Bursa Teknoloji Zirvesi',
  'Teknoloji ve inovasyonun bir araya geldiği zirve.',
  '2024-08-15',
  '14:00',
  'Merinos Kongre Merkezi',
  'Bursa',
  NULL,
  'diger',
  200.00
)
ON CONFLICT DO NOTHING;

-- Eklenen etkinlikleri kontrol et (tarihe göre sıralı)
SELECT 
  id,
  title,
  date,
  venue,
  location,
  category,
  price_from,
  created_at
FROM public.events 
ORDER BY date DESC;
