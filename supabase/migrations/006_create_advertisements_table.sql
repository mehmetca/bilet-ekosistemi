-- Advertisements tablosu oluşturma
CREATE TABLE IF NOT EXISTS advertisements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  placement TEXT NOT NULL, -- 'news_slider', 'hero', 'sidebar', etc.
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Policy: Herkes aktif reklamları görebilir
CREATE POLICY "Advertisements are viewable by everyone" ON advertisements
  FOR SELECT USING (is_active = true);

-- Policy: Sadece adminler reklam yönetebilir
CREATE POLICY "Admins can manage advertisements" ON advertisements
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'authenticated' AND 
    auth.jwt() ->> 'user_data' ->> 'role' IN ('admin', 'controller')
  );

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_advertisements_placement ON advertisements(placement);
CREATE INDEX IF NOT EXISTS idx_advertisements_active ON advertisements(is_active);
CREATE INDEX IF NOT EXISTS idx_advertisements_sort ON advertisements(sort_order);

-- Örnek veri ekle (isteğe bağlı)
INSERT INTO advertisements (title, image_url, link_url, placement, is_active, sort_order) VALUES
(
  'Örnek Reklam',
  'https://dzncmwjffopednfgjwlo.supabase.co/storage/v1/object/public/advertisements/sample.jpg',
  'https://example.com',
  'news_slider',
  true,
  1
) ON CONFLICT DO NOTHING;
