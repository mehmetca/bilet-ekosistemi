-- Bilet e-postası yeniden gönderim günlüğü.
--
-- Neden: "Bilet gelmedi" durumunda müşteri/admin kendi kendine tekrar gönderebilsin,
-- sunucu tarafında saatte 1 / günde 5 limit uygulanabilsin ve arayüzde
-- "Son Mail Gönderimi" damgası gösterilebilsin. Sipariş tablosuna kolon eklemek
-- limit geçmişini tutmaz; bu yüzden ayrı log tablosu.
--
-- Yazma yalnız service role API route'undan yapılır (INSERT politikası bilinçli yok).

CREATE TABLE IF NOT EXISTS public.ticket_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'customer' CHECK (source IN ('admin', 'customer', 'purchase')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_email_logs_order
  ON public.ticket_email_logs(order_id, sent_at DESC);

COMMENT ON TABLE public.ticket_email_logs IS
  'Bilet e-postası gönderim günlüğü: son gönderim damgası ve saatlik/günlük limit sayacı.';
COMMENT ON COLUMN public.ticket_email_logs.source IS
  'purchase = satın alma anındaki otomatik gönderim, customer/admin = yeniden gönderim.';

ALTER TABLE public.ticket_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read email logs of their orders" ON public.ticket_email_logs;
CREATE POLICY "Users can read email logs of their orders"
  ON public.ticket_email_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = ticket_email_logs.order_id
        AND (
          o.user_id = auth.uid()
          OR (o.user_id IS NULL AND o.buyer_email = auth.jwt() ->> 'email')
        )
    )
  );

DROP POLICY IF EXISTS "Admin can read all ticket email logs" ON public.ticket_email_logs;
CREATE POLICY "Admin can read all ticket email logs"
  ON public.ticket_email_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
