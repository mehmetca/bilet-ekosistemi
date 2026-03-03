-- minimal_insert_order function'ını tamamen kaldır ve farklı isimle oluştur
DROP FUNCTION IF EXISTS public.minimal_insert_order() CASCADE;

-- Eski trigger'ı drop et
DROP TRIGGER IF EXISTS minimal_insert_order_trigger ON hero_backgrounds;
DROP TRIGGER IF EXISTS hero_backgrounds_auto_sort_trigger ON hero_backgrounds;

-- Tamamen yeni isimle function oluştur
CREATE OR REPLACE FUNCTION public.hero_background_auto_sort()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sort_order = COALESCE(
    (SELECT MAX(sort_order) + 1 FROM hero_backgrounds WHERE placement = NEW.placement),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Yeni trigger ile yeni function'ı bağla
CREATE TRIGGER hero_backgrounds_auto_sort_trigger
  BEFORE INSERT ON hero_backgrounds
  FOR EACH ROW EXECUTE FUNCTION public.hero_background_auto_sort();
