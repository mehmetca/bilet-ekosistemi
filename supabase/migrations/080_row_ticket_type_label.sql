-- Sıra bazlı bilet türü eşleştirmesi (örn. 1. sıra VIP, 2-4 Kategori 1)
ALTER TABLE public.seating_plan_rows
  ADD COLUMN IF NOT EXISTS ticket_type_label TEXT;

COMMENT ON COLUMN public.seating_plan_rows.ticket_type_label IS
  'Etkinlikteki bilet türü adı (Kategori 1, VIP vb.); varsa bölüm etiketine göre önceliklidir.';
