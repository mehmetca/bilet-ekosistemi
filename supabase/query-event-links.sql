-- Etkinlik link yapısı: hangi alanlar dolu, link nasıl kurulur?
-- Supabase SQL Editor'da çalıştırın (Production ve Local için ayrı ayrı, sonuçları karşılaştırın).

SELECT
  id,
  LEFT(title, 40) AS title_short,
  slug,
  show_slug,
  is_active,
  is_approved,
  -- Link nasıl olur: show_slug varsa o, yoksa slug, yoksa id
  CASE
    WHEN show_slug IS NOT NULL AND show_slug != '' THEN '/etkinlik/' || show_slug
    WHEN slug IS NOT NULL AND slug != '' THEN '/etkinlik/' || slug
    ELSE '/etkinlik/' || id
  END AS link_olasi,
  -- Hangi alan kullanılıyor
  CASE
    WHEN show_slug IS NOT NULL AND show_slug != '' THEN 'show_slug'
    WHEN slug IS NOT NULL AND slug != '' THEN 'slug'
    ELSE 'id'
  END AS link_kaynagi
FROM events
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 50;

-- Özet: kaç etkinlikte slug/show_slug dolu?
SELECT
  COUNT(*) AS toplam_etkinlik,
  COUNT(slug) FILTER (WHERE slug IS NOT NULL AND slug != '') AS slug_dolu,
  COUNT(show_slug) FILTER (WHERE show_slug IS NOT NULL AND show_slug != '') AS show_slug_dolu,
  COUNT(*) FILTER (WHERE is_approved = true) AS onayli,
  COUNT(*) FILTER (WHERE is_approved = false OR is_approved IS NULL) AS onaysiz_veya_null
FROM events
WHERE is_active = true;

-- Tüm etkinliklerin adresleri (path): dolu olanların URL'si
-- Sitede kullanılan format: /tr/etkinlik/... veya /de/etkinlik/... (locale + path)
SELECT
  id,
  LEFT(title, 50) AS title_short,
  slug,
  show_slug,
  is_approved,
  -- Path (locale ekleyince tam URL: https://site.com/tr/etkinlik/...)
  '/tr/etkinlik/' || CASE
    WHEN show_slug IS NOT NULL AND show_slug != '' THEN show_slug
    WHEN slug IS NOT NULL AND slug != '' THEN slug
    ELSE id::text
  END AS url_tr,
  '/de/etkinlik/' || CASE
    WHEN show_slug IS NOT NULL AND show_slug != '' THEN show_slug
    WHEN slug IS NOT NULL AND slug != '' THEN slug
    ELSE id::text
  END AS url_de,
  '/en/etkinlik/' || CASE
    WHEN show_slug IS NOT NULL AND show_slug != '' THEN show_slug
    WHEN slug IS NOT NULL AND slug != '' THEN slug
    ELSE id::text
  END AS url_en
FROM events
WHERE is_active = true
ORDER BY created_at DESC;
