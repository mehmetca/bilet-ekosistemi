-- Satılan koltukları kaydet – hangi siparişte hangi koltuk satıldı.
-- Böylece salon planında "dolu" koltuklar gösterilir ve tekrar satılmaz.

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

-- Sadece service_role / backend sipariş oluştururken yazar; kullanıcı okuyabilir (kendi siparişindeki koltuklar)
CREATE POLICY "Users can view order_seats of their orders"
  ON public.order_seats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_seats.order_id
      AND (o.user_id = auth.uid() OR (o.user_id IS NULL AND o.buyer_email = auth.jwt() ->> 'email'))
    )
  );

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
