-- Supabase storage buckets tablosunu kontrol et ve oluştur
-- Not: storage.buckets tablosu bazı versiyonlarda farklı olabilir

-- Mevcut bucket'ları kontrol et
SELECT * FROM buckets;

-- Eğer event-images bucket'ı yoksa oluştur
INSERT INTO buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  gen_random_uuid(),
  'event-images',
  true,
  10737418240, -- 10GB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Eğer artists bucket'ı yoksa oluştur
INSERT INTO buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  gen_random_uuid(),
  'artists',
  true,
  10737418240, -- 10GB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Bucket'ları yeniden kontrol et
SELECT id, name, public FROM buckets WHERE name IN ('event-images', 'artists');

-- Storage objects tablosunu kontrol et
SELECT * FROM storage.objects LIMIT 5;

-- Public access policy oluştur (eğer yoksa)
-- Not: storage.objects tablosu bazı versiyonlarda farklı olabilir

-- Policy for event-images bucket
CREATE POLICY "Public Read Access for event-images" ON storage.objects 
FOR SELECT USING (bucket_id = (SELECT id FROM buckets WHERE name = 'event-images'));

-- Policy for artists bucket
CREATE POLICY "Public Read Access for artists" ON storage.objects 
FOR SELECT USING (bucket_id = (SELECT id FROM buckets WHERE name = 'artists'));

-- Policies kontrol et
SELECT * FROM policies WHERE name IN ('Public Read Access for event-images', 'Public Read Access for artists');
