-- Link completed orders to the paid Stripe checkout session that funded them.
-- Multiple order rows can belong to one cart/session, so this is intentionally not unique.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_amount_total INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_currency TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id
  ON public.orders(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
