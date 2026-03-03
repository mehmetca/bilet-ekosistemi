-- Events tablosuna slug ekleme (Ultra Basit Versiyon)

-- 1. Column ekle
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Basit slug oluştur (adım adım)
UPDATE events 
SET slug = REPLACE(title, 'Ç', 'c')
WHERE slug IS NULL;

UPDATE events 
SET slug = REPLACE(slug, 'Ö', 'o')
WHERE slug IS NOT NULL AND slug LIKE '%Ö%';

UPDATE events 
SET slug = REPLACE(slug, 'Ü', 'u')
WHERE slug IS NOT NULL AND slug LIKE '%Ü%';

UPDATE events 
SET slug = REPLACE(slug, 'Ş', 's')
WHERE slug IS NOT NULL AND slug LIKE '%Ş%';

UPDATE events 
SET slug = REPLACE(slug, 'İ', 'i')
WHERE slug IS NOT NULL AND slug LIKE '%İ%';

UPDATE events 
SET slug = REPLACE(slug, 'Ğ', 'g')
WHERE slug IS NOT NULL AND slug LIKE '%Ğ%';

UPDATE events 
SET slug = REPLACE(slug, ' ', '-')
WHERE slug IS NOT NULL;

-- 3. Küçük harf yap
UPDATE events 
SET slug = LOWER(slug)
WHERE slug IS NOT NULL;

-- 4. Sadece alfanumerik karakterler bırak
UPDATE events 
SET slug = REGEXP_REPLACE(slug, '[^a-z0-9-]', '', 'g')
WHERE slug IS NOT NULL;

-- 5. Benzersiz yap (ID ekle)
UPDATE events 
SET slug = slug || '-' || id
WHERE id IN (
    SELECT id FROM events 
    WHERE slug IN (
        SELECT slug FROM events 
        GROUP BY slug 
        HAVING COUNT(*) > 1
    )
);

-- 6. Index ekle
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
