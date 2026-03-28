-- Koridor: dikey önizlemede koltuk etiketinden sonra böl (px yerine)
ALTER TABLE public.seating_plan_sections
  ADD COLUMN IF NOT EXISTS corridor_after_seat_label text NULL;

COMMENT ON COLUMN public.seating_plan_sections.corridor_after_seat_label IS 'corridor_mode=vertical iken önizlemede bu koltuk etiketinden sonra koridor şeridi (örn. 10)';
