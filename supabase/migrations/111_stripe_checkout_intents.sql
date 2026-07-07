-- Stripe checkout oturumları için sunucu tarafı sepet kaydı (webhook fulfillment + tutar doğrulama)
CREATE TABLE IF NOT EXISTS public.stripe_checkout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT,
  buyer_address TEXT,
  buyer_plz TEXT,
  buyer_city TEXT,
  delivery_choice TEXT NOT NULL DEFAULT 'e_ticket'
    CHECK (delivery_choice IN ('e_ticket', 'standard', 'express')),
  seat_hold_session_id TEXT,
  cart_json JSONB NOT NULL,
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'fulfilled', 'failed')),
  fulfillment_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_checkout_intents_session
  ON public.stripe_checkout_intents (stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_stripe_checkout_intents_status
  ON public.stripe_checkout_intents (status, created_at DESC);

ALTER TABLE public.stripe_checkout_intents ENABLE ROW LEVEL SECURITY;

-- Yalnızca service role erişir (API route / webhook)
DROP POLICY IF EXISTS stripe_checkout_intents_service_only ON public.stripe_checkout_intents;
CREATE POLICY stripe_checkout_intents_service_only ON public.stripe_checkout_intents
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.stripe_checkout_intents IS
  'Sunucu tarafında doğrulanmış sepet + Stripe oturumu. Webhook fulfillment için.';
