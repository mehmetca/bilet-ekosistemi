-- Siparişlere adres bilgisi ekle (opsiyonel - fiziksel teslimat veya fatura için)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_address TEXT,
  ADD COLUMN IF NOT EXISTS buyer_plz TEXT,
  ADD COLUMN IF NOT EXISTS buyer_city TEXT;
