-- Hero Backgrounds RLS Policy Fix
-- Mevcut policy'leri sil
DROP POLICY IF EXISTS "Admins can manage hero backgrounds" ON hero_backgrounds;
DROP POLICY IF EXISTS "Everyone can view active hero backgrounds" ON hero_backgrounds;

-- Basit policy: Sadece authenticated kullanıcılar
CREATE POLICY "Admins can manage hero backgrounds" ON hero_backgrounds
  FOR ALL USING (auth.role() = 'authenticated');

-- Herkes görebilir (public)
CREATE POLICY "Everyone can view active hero backgrounds" ON hero_backgrounds
  FOR SELECT USING (true);

-- Storage bucket için policy'ler
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Write Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update Access" ON storage.objects;

-- Public read
CREATE POLICY "Public Read Access" ON storage.objects
FOR SELECT USING (bucket_id = 'hero-backgrounds');

-- Authenticated write
CREATE POLICY "Admin Write Access" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'hero-backgrounds' AND 
  auth.role() = 'authenticated'
);

-- Authenticated update
CREATE POLICY "Admin Update Access" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'hero-backgrounds' AND 
  auth.role() = 'authenticated'
);
