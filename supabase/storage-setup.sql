-- Supabase Storage için bucket oluşturma
-- Supabase Dashboard > Storage bölümünde bu SQL'i çalıştırın

-- Event images bucket'ı oluştur
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images', 
  'event-images', 
  true, 
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Bucket için policy'ler
-- Herkes resimleri yükleyebilir
CREATE POLICY "Herkes resim yükleyebilir" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'event-images');

-- Herkes resimleri görebilir
CREATE POLICY "Herkes resimleri görebilir" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-images');

-- Kullanıcı kendi yüklediği resmi güncelleyebilir
CREATE POLICY "Kullanıcı kendi resmini güncelleyebilir" ON storage.objects
  FOR UPDATE USING (bucket_id = 'event-images');

-- Kullanıcı kendi yüklediği resmi silebilir
CREATE POLICY "Kullanıcı kendi resmini silebilir" ON storage.objects
  FOR DELETE USING (bucket_id = 'event-images');
