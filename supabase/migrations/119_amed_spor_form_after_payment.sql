-- Amed Spor özel form verisini ödeme sonrası kaydetmek için
-- Stripe checkout intent'ine form verisi alanı eklenir.
-- Form verisi form -> localStorage -> sepet -> checkout -> fulfillment zinciriyle
-- taşınır ve ancak ödeme başarılı olduktan sonra event_form_responses'a yazılır.

ALTER TABLE public.stripe_checkout_intents
  ADD COLUMN IF NOT EXISTS form_json JSONB NULL;

COMMENT ON COLUMN public.stripe_checkout_intents.form_json IS
  'Amed Spor özel form verisi (ödeme sonrası event_form_responses kaydı için). Ücretsiz etkinliklerde kullanılmaz.';
