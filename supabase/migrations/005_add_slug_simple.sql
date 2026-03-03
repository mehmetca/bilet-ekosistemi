-- Events tablosuna slug ekleme (Basit PostgreSQL Versiyonu)
-- Önce slug var mı kontrol et
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'slug'
    ) THEN
        ALTER TABLE events ADD COLUMN slug TEXT;
    END IF;
END $$;

-- Basit slug oluştur (sadece İngilizce karakterler)
UPDATE events 
SET slug = LOWER(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(title, 'Ç', 'c')
                    , 'Ö', 'o')
                , 'Ü', 'u')
            , 'Ş', 's')
        , 'İ', 'i')
    , 'Ğ', 'g')
    , ' ', '-')
)
WHERE slug IS NULL;

-- Karakterleri temizle (sadece harf ve rakam)
UPDATE events 
SET slug = REGEXP_REPLACE(slug, '[^a-z0-9-]', '', 'g')
WHERE slug IS NOT NULL;

-- Slug'ları benzersiz yap (ID ekle)
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

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
