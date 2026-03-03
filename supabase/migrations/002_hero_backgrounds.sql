-- Hero Backgrounds Tablosu
CREATE TABLE IF NOT EXISTS hero_backgrounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  transition_duration INTEGER DEFAULT 5000, -- milisaniye
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE hero_backgrounds ENABLE ROW LEVEL SECURITY;

-- Sadece admin'ler işlem yapabilir (varsa sil, yoksa oluştur)
DROP POLICY IF EXISTS "Admins can manage hero backgrounds" ON hero_backgrounds;
CREATE POLICY "Admins can manage hero backgrounds" ON hero_backgrounds
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND auth.jwt() ->> 'role' = 'admin'
  );

-- Herkes aktif background'ları görebilir (varsa sil, yoksa oluştur)
DROP POLICY IF EXISTS "Everyone can view active hero backgrounds" ON hero_backgrounds;
CREATE POLICY "Everyone can view active hero backgrounds" ON hero_backgrounds
  FOR SELECT USING (is_active = true);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_hero_backgrounds_active ON hero_backgrounds(is_active);
CREATE INDEX IF NOT EXISTS idx_hero_backgrounds_sort ON hero_backgrounds(sort_order);

-- Trigger for updated_at (varsa sil, yoksa oluştur)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_hero_backgrounds_updated_at ON hero_backgrounds;
CREATE TRIGGER update_hero_backgrounds_updated_at 
  BEFORE UPDATE ON hero_backgrounds 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
