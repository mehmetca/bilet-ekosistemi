-- Her adet bilet için tekil bilet birimi (koltuksuz akış dahil).
-- Amaç: quantity > 1 alımlarda her biletin ayrı QR/ticket_code ile
-- tek kullanımlık doğrulanabilmesi.

CREATE TABLE IF NOT EXISTS public.order_ticket_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_code TEXT NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_ticket_units_ticket_code_unique
  ON public.order_ticket_units(ticket_code);

CREATE INDEX IF NOT EXISTS idx_order_ticket_units_order
  ON public.order_ticket_units(order_id);

CREATE INDEX IF NOT EXISTS idx_order_ticket_units_event
  ON public.order_ticket_units(event_id);

COMMENT ON TABLE public.order_ticket_units IS
  'Her siparişteki adet bazlı tekil bilet birimleri; her birinin ayrı ticket_code/QR ve checked_at alanı vardır.';
COMMENT ON COLUMN public.order_ticket_units.ticket_code IS
  'Tekil bilet kodu (QR/barkod içeriği).';
COMMENT ON COLUMN public.order_ticket_units.checked_at IS
  'Bu bilet biriminin girişte okutulduğu an.';

ALTER TABLE public.order_ticket_units ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_ticket_units'
      AND policyname = 'Users can view ticket units of their orders'
  ) THEN
    CREATE POLICY "Users can view ticket units of their orders"
      ON public.order_ticket_units
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.orders o
          WHERE o.id = order_ticket_units.order_id
            AND (
              o.user_id = auth.uid()
              OR (o.user_id IS NULL AND o.buyer_email = auth.jwt() ->> 'email')
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_ticket_units'
      AND policyname = 'Service role and admins manage ticket units'
  ) THEN
    CREATE POLICY "Service role and admins manage ticket units"
      ON public.order_ticket_units
      FOR ALL
      USING (
        auth.jwt() ->> 'role' = 'service_role'
        OR auth.uid() IN (
          SELECT user_id
          FROM public.user_roles
          WHERE role IN ('admin', 'controller')
        )
      )
      WITH CHECK (
        auth.jwt() ->> 'role' = 'service_role'
        OR auth.uid() IN (
          SELECT user_id
          FROM public.user_roles
          WHERE role IN ('admin', 'controller')
        )
      );
  END IF;
END $$;
