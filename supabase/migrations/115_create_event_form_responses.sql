-- Not: has_custom_form alanı 114 migration'ında events tablosuna eklendi
-- Bu migration sadece event_form_responses tablosunu oluşturur

-- Amed Spor özel form cevapları tablosu
CREATE TABLE IF NOT EXISTS public.event_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  purchase_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,

  -- Temas bilgileri (zorunlu)
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,

  -- Organizasyon bilgileri
  organization TEXT,

  -- Dil ve iletişim tercihi (zorunlu)
  language_preference TEXT NOT NULL CHECK (language_preference IN ('kurmanci', 'türkçe', 'ingilizce', 'deutsch')),
  accept_phone_contact BOOLEAN NOT NULL DEFAULT true,

  -- Konaklama ve yemek tercihleri
  accommodation_preference TEXT CHECK (accommodation_preference IN ('otel', 'diger', 'kendi_ayarim')),
  meal_preferences TEXT CHECK (meal_preferences IN ('yok', 'vejetaryen', 'vegan', 'helal', 'glutensiz', 'diger')),
  meal_other_text TEXT,

  -- Ek notlar
  additional_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_event_form_responses_event_id ON public.event_form_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_event_form_responses_user_id ON public.event_form_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_event_form_responses_purchase_id ON public.event_form_responses(purchase_id);

-- RLS (Row Level Security) ayarları
ALTER TABLE public.event_form_responses ENABLE ROW LEVEL SECURITY;

-- Tekrar çalıştırılabilir: önceki denemelerde policy kalmış olabilir
DROP POLICY IF EXISTS "Public read access" ON public.event_form_responses;
DROP POLICY IF EXISTS "Authenticated insert" ON public.event_form_responses;
DROP POLICY IF EXISTS "Admin update delete" ON public.event_form_responses;

-- Public okuma (tüm kullanıcılar form cevaplarını görebilir - admin panel için)
CREATE POLICY "Public read access" ON public.event_form_responses
  FOR SELECT USING (true);

-- Authenticated kullanıcılar form gönderebilir
CREATE POLICY "Authenticated insert" ON public.event_form_responses
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admin update/delete yapabilir
CREATE POLICY "Admin update delete" ON public.event_form_responses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE public.event_form_responses IS 'Amed Spor gibi özel form gerektiren etkinlikler için form cevapları';
