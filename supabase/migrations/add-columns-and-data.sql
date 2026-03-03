-- Önce column'ları ekle
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- News tablosu için column'lar
ALTER TABLE public.news 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.news 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.news 
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Şimdi data ekle
INSERT INTO public.events (
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
    'Cem Adrian Konseri',
    'Cem Adrian''un unutulmaz konseri',
    '2024-03-15',
    '20:00',
    'İstanbul',
    'Jolly Joker',
    350.00,
    'https://images.unsplash.com/photo-1492684228673-013e8b840b62?w=1920&h=1080&fit=crop&auto=format',
    'konser',
    true
  ),
  (
    'Komedi Gecesi',
    'En komik stand-up gecesi',
    '2024-03-20',
    '21:00',
    'Ankara',
    'BKM',
    200.00,
    'https://images.unsplash.com/photo-1516280440614-4009c2e53baf?w=1920&h=1080&fit=crop&auto=format',
    'diger',
    true
  ),
  (
    'Tiyatro: Oyuncular',
    'Modern tiyatro oyunu',
    '2024-03-25',
    '19:30',
    'İzmir',
    'İzmir Sanat Merkezi',
    150.00,
    'https://images.unsplash.com/photo-1503095396543-227c4250a3c0?w=1920&h=1080&fit=crop&auto=format',
    'tiyatro',
    true
  );

-- News sample data
INSERT INTO public.news (
  title,
  content,
  excerpt,
  image_url,
  published_at
) VALUES 
  (
    '2024 Konser Sezonu Başlıyor',
    '2024 yılı konser sezonu büyük heyecanla başlıyor. Ünlü sanatçılar şehir turuna çıkıyor...',
    '2024 konser sezonu başlıyor',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1920&h=1080&fit=crop&auto=format',
    NOW()
  ),
  (
    'Tiyatro Festivali Duyurusu',
    'Bu yıl 5. kez düzenlenecek olan tiyatro festivali programı belli oldu...',
    'Tiyatro festivali başlıyor',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&h=1080&fit=crop&auto=format',
    NOW()
  );

-- Kontrol
SELECT COUNT(*) as events_count FROM public.events WHERE is_active = true;
SELECT COUNT(*) as news_count FROM public.news;

-- Mevcut etkinlikleri göster
SELECT title, category, date, is_active FROM public.events ORDER BY date;
