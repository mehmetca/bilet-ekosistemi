-- Salon önizlemesinde bölüm bazlı koridor boşluğu (taslak görünümü; kayıtta saklanır)
ALTER TABLE public.seating_plan_sections
  ADD COLUMN IF NOT EXISTS corridor_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS corridor_gap_px integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.seating_plan_sections.corridor_mode IS 'none: yok | horizontal: yatay koridor (üst-alt bloklar arası) | vertical: dikey koridor (blok yanlarında boşluk)';
COMMENT ON COLUMN public.seating_plan_sections.corridor_gap_px IS 'Koridor kalınlığı (piksel), 0–120';

ALTER TABLE public.seating_plan_sections
  DROP CONSTRAINT IF EXISTS seating_plan_sections_corridor_mode_check;

ALTER TABLE public.seating_plan_sections
  ADD CONSTRAINT seating_plan_sections_corridor_mode_check
  CHECK (corridor_mode IN ('none', 'horizontal', 'vertical'));

ALTER TABLE public.seating_plan_sections
  DROP CONSTRAINT IF EXISTS seating_plan_sections_corridor_gap_check;

ALTER TABLE public.seating_plan_sections
  ADD CONSTRAINT seating_plan_sections_corridor_gap_check
  CHECK (corridor_gap_px >= 0 AND corridor_gap_px <= 120);
