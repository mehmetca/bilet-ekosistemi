-- Bilet Türleri Tablosu
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- ========== Bilet türleri tablosu ==========
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('normal', 'vip')),
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  available INTEGER NOT NULL DEFAULT 100,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- updated_at otomatik güncelleme
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ========== Row Level Security (RLS) ==========
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- tickets tablosundaki tüm policy'leri kaldır
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'tickets' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tickets', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Bilet türleri herkes tarafından okunabilir"
  ON public.tickets FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Bilet türleri eklenebilir"
  ON public.tickets FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Bilet türleri güncellenebilir"
  ON public.tickets FOR UPDATE
  TO anon
  USING (true);

CREATE POLICY "Bilet türleri silinebilir"
  ON public.tickets FOR DELETE
  TO anon
  USING (true);

-- ========== Örnek veri (mevcut etkinlikler için) ==========
INSERT INTO public.tickets (event_id, name, "type", price, quantity, available, description)
SELECT 
  e.id,
  CASE 
    WHEN row_num = 1 THEN 'Standart Bilet'
    ELSE 'VIP Bilet'
  END,
  CASE 
    WHEN row_num = 1 THEN 'normal'
    ELSE 'vip'
  END,
  CASE 
    WHEN row_num = 1 THEN e.price_from
    ELSE e.price_from * 2.5
  END,
  100,
  100,
  CASE 
    WHEN row_num = 1 THEN 'Standart giriş'
    ELSE 'VIP alanı, özel hizmetler'
  END
FROM public.events e
CROSS JOIN (SELECT generate_series(1,2) as row_num) AS series
WHERE EXISTS (SELECT 1 FROM public.events LIMIT 1)
ON CONFLICT DO NOTHING;
