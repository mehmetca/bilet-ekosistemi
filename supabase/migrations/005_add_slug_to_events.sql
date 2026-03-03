-- Events tablosunda slug kontrolü
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'slug';

-- Eğer slug yoksa eklemek için
ALTER TABLE events ADD COLUMN slug TEXT;

-- Mevcut events için slug oluştur (title'dan)
UPDATE events 
SET slug = LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9\s]', '', 'g'))
WHERE slug IS NULL;

-- Slug'ları benzersiz yap
UPDATE events e1
SET slug = e1.slug || '-' || e1.id
WHERE EXISTS (
  SELECT 1 FROM events e2 
  WHERE e2.slug = e1.slug AND e2.id != e1.id
);
