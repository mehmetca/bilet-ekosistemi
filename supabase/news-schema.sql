-- Haberler tablosu
CREATE TABLE IF NOT EXISTS news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  author_id UUID REFERENCES auth.users(id),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- RLS devre dışı bırak
ALTER TABLE news DISABLE ROW LEVEL SECURITY;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_news_updated_at BEFORE UPDATE
    ON news FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Örnek haberler
INSERT INTO news (title, content, summary, image_url, is_published, published_at) VALUES
(
  'Bilet Ekosistemi Yeni Özelliklerle Geliyor!',
  'Bilet Ekosistemi olarak yeni özellikler üzerinde çalışıyoruz. QR kodlu biletler, etkinlik takvimi ve daha birçok yenilik yakında...',
  'Platformumuza eklenen yeni özellikler ve geliştirmeler hakkında detaylı bilgi.',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
  true,
  NOW()
),
(
  'Yaz Konserleri Bilet Satışta!',
  'Yaz aylarında düzenlenecek olan açık hava konserleri için bilet satışları başladı. Erken rezervasyon ile avantajlı fiyatlar...',
  'Yaz konserleri programı ve bilet satışları hakkında tüm detaylar.',
  'https://images.unsplash.com/photo-1459749411177-446b2fc2379c?w=800',
  true,
  NOW() - INTERVAL '1 day'
),
(
  'Tiyatro Sezonu Açılıyor',
  'Bu yılki tiyatro sezonu çok özel oyunlarla başlıyor. Önde gelen tiyatro topluluklarının sahneleyeceği oyunlar...',
  'Yeni tiyatro sezonunun açılışı ve programı hakkında bilgiler.',
  'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800',
  true,
  NOW() - INTERVAL '2 days'
);
