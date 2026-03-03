-- Events sample data ekleme
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
  is_active
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
    'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/events/cem-adrian.jpg',
    'konser',
    true
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
    'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/events/standup.jpg',
    'stand-up',
    true
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
    'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/events/tiyatro.jpg',
    'tiyatro',
    true
  );

-- News sample data ekleme
INSERT INTO public.news (
  id,
  title,
  content,
  excerpt,
  image_url,
  published_at
) VALUES 
  (
    gen_random_uuid(),
    '2024 Konser Sezonu Başlıyor',
    '2024 yılı konser sezonu büyük heyecanla başlıyor. Ünlü sanatçılar şehir turuna çıkıyor...',
    '2024 konser sezonu başlıyor',
    'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/news/konser-sezonu.jpg',
    NOW()
  ),
  (
    gen_random_uuid(),
    'Tiyatro Festivali Duyurusu',
    'Bu yıl 5. kez düzenlenecek olan tiyatro festivali programı belli oldu...',
    'Tiyatro festivali başlıyor',
    'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/news/tiyatro-festivali.jpg',
    NOW()
  );

-- Kontrol
SELECT COUNT(*) as events_count FROM events WHERE is_active = true;
SELECT COUNT(*) as news_count FROM news;
