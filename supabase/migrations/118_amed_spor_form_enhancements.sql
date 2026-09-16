-- Amed Spor formu ve ek hizmetler geliştirmesi (118)

-- 1. events tablosuna form ayarları ve ek ücretler
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS custom_form_max_attendees INTEGER NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS accommodation_price NUMERIC(10, 2) NULL,
  ADD COLUMN IF NOT EXISTS flight_price NUMERIC(10, 2) NULL;

COMMENT ON COLUMN public.events.custom_form_max_attendees IS 'Özel formda tek seferde seçilebilecek maksimum bilet/katılımcı sayısı (varsayılan 3)';
COMMENT ON COLUMN public.events.accommodation_price IS 'Kişi başı konaklama ek ücreti (NULL veya 0 ise formda görünmez)';
COMMENT ON COLUMN public.events.flight_price IS 'Kişi başı uçak bileti ek ücreti (NULL veya 0 ise formda görünmez)';

-- 2. event_form_responses tablosuna katılımcı detayları ve tercihler
ALTER TABLE public.event_form_responses
  ADD COLUMN IF NOT EXISTS id_country TEXT NULL,
  ADD COLUMN IF NOT EXISTS passo_number TEXT NULL,
  ADD COLUMN IF NOT EXISTS seating_preference TEXT NULL,
  ADD COLUMN IF NOT EXISTS has_accommodation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accommodation_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_flight BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flight_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.event_form_responses.id_country IS 'Katılımcının kimlik/pasaport ülkesi (vatandaşlık)';
COMMENT ON COLUMN public.event_form_responses.passo_number IS 'Katılımcının Passo numarası';
COMMENT ON COLUMN public.event_form_responses.seating_preference IS 'Tribün tercihi: vip (VIP Tribünü) veya loca (Özel Loca)';
COMMENT ON COLUMN public.event_form_responses.has_accommodation IS 'Konaklama istendi mi?';
COMMENT ON COLUMN public.event_form_responses.accommodation_fee IS 'Kişi başı konaklama ücreti';
COMMENT ON COLUMN public.event_form_responses.has_flight IS 'Uçak bileti istendi mi?';
COMMENT ON COLUMN public.event_form_responses.flight_fee IS 'Kişi başı uçak bileti ücreti';
