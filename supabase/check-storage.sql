-- Storage bucket'larını kontrol et
SELECT bucket_name, created_at 
FROM storage.buckets 
ORDER BY created_at;

-- event-images bucket'ını kontrol et
SELECT * FROM storage.buckets WHERE name = 'event-images';

-- Eğer bucket yoksa oluştur
INSERT INTO storage.buckets (name, public)
VALUES ('event-images', true);

-- Bucket permissions kontrol et
SELECT * FROM storage.buckets WHERE name = 'artists';

-- Eğer artists bucket'ı yoksa oluştur
INSERT INTO storage.buckets (name, public)
VALUES ('artists', true);

-- Policies kontrol et
SELECT * FROM storage.policies WHERE bucket_name IN ('event-images', 'artists');

-- Public access policy oluştur (eğer yoksa)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('event-images', 'artists'));

-- Bucket'ları yeniden kontrol et
SELECT bucket_name, public FROM storage.buckets WHERE name IN ('event-images', 'artists');
