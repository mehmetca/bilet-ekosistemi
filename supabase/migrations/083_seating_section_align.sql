-- Bölüm önizleme hizasını kalıcı sakla (sol/orta/sağ)
ALTER TABLE public.seating_plan_sections
  ADD COLUMN IF NOT EXISTS section_align text NULL;

COMMENT ON COLUMN public.seating_plan_sections.section_align IS 'Bölüm önizleme hizası: left | center | right';

ALTER TABLE public.seating_plan_sections
  DROP CONSTRAINT IF EXISTS seating_plan_sections_section_align_check;

ALTER TABLE public.seating_plan_sections
  ADD CONSTRAINT seating_plan_sections_section_align_check
  CHECK (section_align IS NULL OR section_align IN ('left', 'center', 'right'));
