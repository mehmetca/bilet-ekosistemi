-- Quick fix - Sample etkinlik verileri
-- Events tablosuna sample data ekle

INSERT INTO public.events (
  id, 
  title, 
  description, 
  date, 
  time, 
  location, 
  venue, 
  price_from, 
  image_url, 
  category, 
  is_active,
  created_at,
  updated_at
) VALUES 
  (
    gen_random_uuid(),
    'Cem Adrian Konseri',
    'Cem Adrian''un unutulmaz konseri',
    '2024-03-15',
    '20:00',
    'İstanbul',
    'Jolly Joker',
    350.00,
    'https://images.unsplash.com/photo-1492684228673-013e8b840b62?w=1920&h=1080&fit=crop&auto=format',
    'konser',
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Stand-up Gecesi',
    'En komik stand-up gecesi',
    '2024-03-20',
    '21:00',
    'Ankara',
    'BKM',
    200.00,
    'https://images.unsplash.com/photo-1516280440614-4009c2e53baf?w=1920&h=1080&fit=crop&auto=format',
    'stand-up',
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Tiyatro: Oyuncular',
    'Modern tiyatro oyunu',
    '2024-03-25',
    '19:30',
    'İzmir',
    'İzmir Sanat Merkezi',
    150.00,
    'https://images.unsplash.com/photo-1503095396543-227c4250a3c0?w=1920&h=1080&fit=crop&auto=format',
    'tiyatro',
    true,
    NOW(),
    NOW()
  );

-- News tablosuna sample data ekle
INSERT INTO public.news (
  id,
  title,
  content,
  excerpt,
  image_url,
  published_at,
  created_at,
  updated_at
) VALUES 
  (
    gen_random_uuid(),
    '2024 Konser Sezonu Başlıyor',
    '2024 yılı konser sezonu büyük heyecanla başlıyor. Ünlü sanatçılar şehir turuna çıkıyor...',
    '2024 konser sezonu başlıyor',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1920&h=1080&fit=crop&auto=format',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Tiyatro Festivali Duyurusu',
    'Bu yıl 5. kez düzenlenecek olan tiyatro festivali programı belli oldu...',
    'Tiyatro festivali başlıyor',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&h=1080&fit=crop&auto=format',
    NOW(),
    NOW(),
    NOW()
  );

-- Kontrol et
SELECT COUNT(*) as events_count FROM public.events WHERE is_active = true;
SELECT COUNT(*) as news_count FROM public.news;
