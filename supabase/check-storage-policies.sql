-- Storage policies kontrol et
SELECT * FROM storage.policies WHERE bucket_name = 'event-images';

-- Eğer policy yoksa public access policy oluştur
CREATE POLICY "Public Read Access for event-images" ON storage.objects 
FOR SELECT USING (bucket_id = (SELECT id FROM buckets WHERE name = 'event-images'));

CREATE POLICY "Public Read Access for artists" ON storage.objects 
FOR SELECT USING (bucket_id = (SELECT id FROM buckets WHERE name = 'artists'));

-- Policies kontrol et
SELECT * FROM storage.policies WHERE name LIKE '%Public Read Access%';

-- Bucket kontrol et
SELECT id, name, public FROM buckets WHERE name IN ('event-images', 'artists');

-- Storage objects kontrol et
SELECT bucket_id, name, created_at FROM storage.objects WHERE bucket_id = (SELECT id FROM buckets WHERE name = 'event-images') LIMIT 10;
