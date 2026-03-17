-- Her koltuk (bilet) için ayrı bilet kodu ve giriş işareti.
-- Böylece 10 bilet alan kişi arkadaşlarına dağıttığında her bilet ayrı kodla okutulur; biri erken gelip okutunca sadece o bilet "kullanıldı" sayılır.

-- order_seats: ticket_code (bilet kodu, her koltuk için benzersiz), checked_at (giriş yapıldı mı)
ALTER TABLE public.order_seats
  ADD COLUMN IF NOT EXISTS ticket_code TEXT,
  ADD COLUMN IF NOT EXISTS checked_at TIMESTAMP WITH TIME ZONE;

-- Benzersiz bilet kodu (yeni eklenen satırlarda doldurulacak)
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_seats_ticket_code
  ON public.order_seats (ticket_code)
  WHERE ticket_code IS NOT NULL;

COMMENT ON COLUMN public.order_seats.ticket_code IS 'Bu koltuğa ait benzersiz bilet kodu (QR/barkod). Girişte bu kod okutulur.';
COMMENT ON COLUMN public.order_seats.checked_at IS 'Bu biletin girişte okutulduğu an; dolu ise "bilet kullanılmıştır" uyarısı verilir.';
