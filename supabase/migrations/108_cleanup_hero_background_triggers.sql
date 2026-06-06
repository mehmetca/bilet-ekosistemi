-- hero_backgrounds: aynı işi yapan 3 INSERT trigger birikmiş (008_* migration varyantları).
-- Yalnızca hero_background_auto_sort kalır; sort_order ataması tek trigger ile yapılır.

DROP TRIGGER IF EXISTS hero_backgrounds_sort_trigger ON public.hero_backgrounds;
DROP TRIGGER IF EXISTS minimal_insert_order_trigger ON public.hero_backgrounds;

DROP FUNCTION IF EXISTS public.hero_backgrounds_sort_order() CASCADE;
DROP FUNCTION IF EXISTS public.minimal_insert_order() CASCADE;
