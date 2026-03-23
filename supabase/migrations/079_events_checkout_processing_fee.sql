-- Sipariş başına (sepet ödemesi) isteğe bağlı işlem ücreti; tutar yalnızca sunucuda events tablosundan okunur.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS checkout_processing_fee NUMERIC(12, 2) NULL;

COMMENT ON COLUMN public.events.checkout_processing_fee IS 'Optional fixed fee per checkout for this event (charged at most once per cart checkout; amount enforced server-side).';
