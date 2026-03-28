-- Fiziksel bilet gönderimi: sipariş başına kargo ücreti ve teslimat türü
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_fee numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method text NULL;

COMMENT ON COLUMN public.orders.shipping_fee IS 'Fiziksel gönderim ücreti (aynı checkout’ta yalnızca ilk satırda uygulanır).';
COMMENT ON COLUMN public.orders.delivery_method IS 'e_ticket | standard | express';

-- PostgREST şema önbelleğini yenile (Dashboard → Settings → API → Reload schema da yapılabilir)
NOTIFY pgrst, 'reload schema';
