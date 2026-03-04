-- ============================================================
-- Çok dilli içerik desteği (TR, DE, EN)
-- Events, Venues, Artists, News tablolarına locale kolonları eklenir
-- ============================================================

-- 1. EVENTS tablosu
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS title_tr TEXT,
  ADD COLUMN IF NOT EXISTS title_de TEXT,
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS description_tr TEXT,
  ADD COLUMN IF NOT EXISTS description_de TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS venue_tr TEXT,
  ADD COLUMN IF NOT EXISTS venue_de TEXT,
  ADD COLUMN IF NOT EXISTS venue_en TEXT;

-- Mevcut veriyi title/description'dan title_tr/description_tr'ye kopyala
UPDATE public.events
SET title_tr = COALESCE(title_tr, title),
    description_tr = COALESCE(description_tr, description),
    venue_tr = COALESCE(venue_tr, venue)
WHERE title_tr IS NULL OR description_tr IS NULL OR venue_tr IS NULL;

-- 2. VENUES tablosu
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS name_tr TEXT,
  ADD COLUMN IF NOT EXISTS name_de TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS address_tr TEXT,
  ADD COLUMN IF NOT EXISTS address_de TEXT,
  ADD COLUMN IF NOT EXISTS address_en TEXT,
  ADD COLUMN IF NOT EXISTS city_tr TEXT,
  ADD COLUMN IF NOT EXISTS city_de TEXT,
  ADD COLUMN IF NOT EXISTS city_en TEXT,
  ADD COLUMN IF NOT EXISTS seating_layout_description_tr TEXT,
  ADD COLUMN IF NOT EXISTS seating_layout_description_de TEXT,
  ADD COLUMN IF NOT EXISTS seating_layout_description_en TEXT,
  ADD COLUMN IF NOT EXISTS transport_info_tr TEXT,
  ADD COLUMN IF NOT EXISTS transport_info_de TEXT,
  ADD COLUMN IF NOT EXISTS transport_info_en TEXT,
  ADD COLUMN IF NOT EXISTS entrance_info_tr TEXT,
  ADD COLUMN IF NOT EXISTS entrance_info_de TEXT,
  ADD COLUMN IF NOT EXISTS entrance_info_en TEXT,
  ADD COLUMN IF NOT EXISTS rules_tr TEXT,
  ADD COLUMN IF NOT EXISTS rules_de TEXT,
  ADD COLUMN IF NOT EXISTS rules_en TEXT;

-- Mevcut venue verisini name/address/city'den _tr'ye kopyala
UPDATE public.venues
SET name_tr = COALESCE(name_tr, name),
    address_tr = COALESCE(address_tr, address),
    city_tr = COALESCE(city_tr, city),
    seating_layout_description_tr = COALESCE(seating_layout_description_tr, seating_layout_description),
    transport_info_tr = COALESCE(transport_info_tr, transport_info),
    entrance_info_tr = COALESCE(entrance_info_tr, entrance_info),
    rules_tr = COALESCE(rules_tr, rules)
WHERE name_tr IS NULL;

-- 3. ARTISTS tablosu (name genelde aynı kalır, bio çevrilir)
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS name_tr TEXT,
  ADD COLUMN IF NOT EXISTS name_de TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS bio_tr TEXT,
  ADD COLUMN IF NOT EXISTS bio_de TEXT,
  ADD COLUMN IF NOT EXISTS bio_en TEXT;

UPDATE public.artists
SET name_tr = COALESCE(name_tr, name),
    bio_tr = COALESCE(bio_tr, bio)
WHERE name_tr IS NULL;

-- 4. NEWS tablosu
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS title_tr TEXT,
  ADD COLUMN IF NOT EXISTS title_de TEXT,
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS content_tr TEXT,
  ADD COLUMN IF NOT EXISTS content_de TEXT,
  ADD COLUMN IF NOT EXISTS content_en TEXT,
  ADD COLUMN IF NOT EXISTS excerpt_tr TEXT,
  ADD COLUMN IF NOT EXISTS excerpt_de TEXT,
  ADD COLUMN IF NOT EXISTS excerpt_en TEXT;

UPDATE public.news
SET title_tr = COALESCE(title_tr, title),
    content_tr = COALESCE(content_tr, content),
    excerpt_tr = COALESCE(excerpt_tr, excerpt)
WHERE title_tr IS NULL;

-- venues.faq JSONB - soru/cevap çiftleri dil bazlı olabilir; şimdilik mevcut yapıyı koruyoruz
-- (İleride faq_tr, faq_de, faq_en JSONB eklenebilir)
