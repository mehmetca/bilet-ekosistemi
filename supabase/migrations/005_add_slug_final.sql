-- Events tablosuna slug ekleme (En Basit Versiyon)

-- 1. Column ekle
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Türkçe karakterleri değiştir
UPDATE events 
SET slug = LOWER(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(title, 'Ç', 'c'), 'Ö', 'o')
                    , 'Ü', 'u')
                , 'Ş', 's')
            , 'İ', 'i')
        , 'Ğ', 'g')
    , ' ', '-')
)
WHERE slug IS NULL;

-- 3. Sadece alfanumerik karakterler bırak
UPDATE events 
SET slug = REGEXP_REPLACE(slug, '[^a-z0-9-]', '', 'g')
WHERE slug IS NOT NULL;

-- 4. Benzersiz yap (ID ekle)
UPDATE events 
SET slug = CASE 
    WHEN EXISTS (
        SELECT 1 FROM events e2 
        WHERE e2.slug = events.slug AND e2.id != events.id
    ) THEN slug || '-' || id
    ELSE slug
END;

-- 5. Index ekle
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
