-- Storage Bucket Kontrolü
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- Storage bucket'ları kontrol et
SELECT 
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE name = 'event-images';

-- Event-images bucket'ı oluştur (eğer yoksa)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,
  52428800, -- 50MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket policy'leri kontrol et
SELECT 
  bucket_id,
  name,
  definition
FROM storage.policies 
WHERE bucket_id = 'event-images';

-- Public access policy oluştur
INSERT INTO storage.policies (
  name,
  bucket_id,
  definition
)
VALUES (
  'Public Access',
  'event-images',
  'bucket_id = ''event-images'' AND (auth.role() = ''authenticated'' OR auth.role() = ''anon'')'
)
ON CONFLICT (name, bucket_id) DO NOTHING;

-- Storage objects tablosunu kontrol et
SELECT 
  bucket_id,
  name,
  created_at
FROM storage.objects 
WHERE bucket_id = 'event-images'
ORDER BY created_at DESC
LIMIT 10;
