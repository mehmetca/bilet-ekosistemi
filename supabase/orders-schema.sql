-- Orders Tablosu
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- ========== Siparişler tablosu ==========
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  ticket_code TEXT NOT NULL UNIQUE,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- updated_at otomatik güncelleme
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ========== Row Level Security (RLS) ==========
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- orders tablosundaki tüm policy'leri kaldır
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'orders' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', r.policyname);
  END LOOP;
END $$;

-- Policy'ler oluştur
CREATE POLICY "Siparişler herkes tarafından okunabilir"
  ON public.orders FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Siparişler eklenebilir"
  ON public.orders FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Siparişler güncellenebilir"
  ON public.orders FOR UPDATE
  TO anon
  USING (true);

CREATE POLICY "Siparişler silinebilir"
  ON public.orders FOR DELETE
  TO anon
  USING (true);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_orders_ticket_code ON public.orders(ticket_code);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON public.orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_email ON public.orders(buyer_email);
