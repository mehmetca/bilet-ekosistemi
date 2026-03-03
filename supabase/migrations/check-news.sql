-- News tablosunu kontrol et
SELECT COUNT(*) as news_count FROM public.news;

-- News verilerini göster
SELECT title, published_at FROM public.news ORDER BY published_at DESC;

-- News yoksa sample data ekle
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
  )
ON CONFLICT DO NOTHING;
