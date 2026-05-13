-- Bilet satırları: sihirbaz / oturum planı sırası (fiyat ve koltuk modunda aynı liste)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tickets_event_sort ON public.tickets (event_id, sort_order);

COMMENT ON COLUMN public.tickets.sort_order IS 'Etkinlik başına görüntüleme sırası (0 tabanlı; sihirbaz kaydeder).';
