-- order_seats tablosu yoksa oluştur (073 ile aynı); sonra seat_id UNIQUE ekle.
-- Böylece schema cache'de tablo bulunur ve çift satış engellenir.

-- 1) Tablo yoksa oluştur
CREATE TABLE IF NOT EXISTS public.order_seats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  section_name TEXT,
  row_label TEXT,
  seat_label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_order_seats_order ON public.order_seats(order_id);
CREATE INDEX IF NOT EXISTS idx_order_seats_seat ON public.order_seats(seat_id);

COMMENT ON TABLE public.order_seats IS 'Siparişte satılan koltuklar (yer seçerek bilet al). Bilet üzerinde ve salon planında dolu gösterimi için.';

ALTER TABLE public.order_seats ENABLE ROW LEVEL SECURITY;

-- RLS politikaları (yoksa oluştur)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_seats' AND policyname = 'Users can view order_seats of their orders') THEN
    CREATE POLICY "Users can view order_seats of their orders"
      ON public.order_seats FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_seats.order_id
          AND (o.user_id = auth.uid() OR (o.user_id IS NULL AND o.buyer_email = auth.jwt() ->> 'email'))
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_seats' AND policyname = 'Service role and admins manage order_seats') THEN
    CREATE POLICY "Service role and admins manage order_seats"
      ON public.order_seats FOR ALL
      USING (
        auth.jwt() ->> 'role' = 'service_role'
        OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
      )
      WITH CHECK (
        auth.jwt() ->> 'role' = 'service_role'
        OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
      );
  END IF;
END $$;

-- 2) Bir koltuk sadece bir siparişte satılabilir: seat_id UNIQUE
DO $$
BEGIN
  -- Duplicate kayıtları sil (aynı seat_id, eski olanlar)
  DELETE FROM public.order_seats a
  USING public.order_seats b
  WHERE a.seat_id = b.seat_id AND a.created_at < b.created_at;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_seats_seat_id_unique') THEN
    ALTER TABLE public.order_seats ADD CONSTRAINT order_seats_seat_id_unique UNIQUE (seat_id);
    COMMENT ON CONSTRAINT order_seats_seat_id_unique ON public.order_seats IS 'Bir koltuk sadece bir siparişte satılabilir; çift satış engeli.';
  END IF;
END $$;
