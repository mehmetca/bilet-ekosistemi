-- Advertisements tablosu oluşturma (Column Fix)

-- Önce mevcut policy'leri drop et
DROP POLICY IF EXISTS "Advertisements are viewable by everyone" ON advertisements;
DROP POLICY IF EXISTS "Admins can manage advertisements" ON advertisements;

-- Tablo oluştur (eğer yoksa)
CREATE TABLE IF NOT EXISTS advertisements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  placement TEXT NOT NULL, -- 'news_slider', 'hero', 'sidebar', etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS aktif et
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Policy: Herkes aktif reklamları Görebilir
CREATE POLICY "Advertisements are viewable by everyone" ON advertisements
  FOR SELECT USING (is_active = true);

-- Policy: Sadece adminler reklam yönetebilir (Basit versiyon)
CREATE POLICY "Admins can manage advertisements" ON advertisements
  FOR ALL USING (
    auth.role() = 'authenticated'
  );

-- Index'ler (sort_order olmadan)
CREATE INDEX IF NOT EXISTS idx_advertisements_placement ON advertisements(placement);
CREATE INDEX IF NOT EXISTS idx_advertisements_active ON advertisements(is_active);

-- Örnek veri ekle (isteğe bağlı)
INSERT INTO advertisements (title, image_url, link_url, placement, is_active) VALUES
(
  'Örnek Reklam',
  'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/advertisements/sample.jpg',
  'https://example.com',
  'news_slider',
  true
) ON CONFLICT DO NOTHING;
