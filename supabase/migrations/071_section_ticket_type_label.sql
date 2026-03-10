-- Bölüme bilet türü eşlemesi: etkinlikteki bilet adı (Kategori 1, VIP vb.) ile eşleşir; koltuk fiyatı bu biletin fiyatı olur
ALTER TABLE public.seating_plan_sections
  ADD COLUMN IF NOT EXISTS ticket_type_label TEXT;

COMMENT ON COLUMN public.seating_plan_sections.ticket_type_label IS 'Etkinlikteki bilet türü adı (örn. Kategori 1, VIP); koltuk seçiminde bu biletin fiyatı kullanılır.';
