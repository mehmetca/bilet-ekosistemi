-- Function'ı farklı isimle oluştur (security fix)
DROP FUNCTION IF EXISTS public.minimal_insert_order() CASCADE;

-- Yeni isimle function oluştur
CREATE OR REPLACE FUNCTION public.hero_backgrounds_sort_order()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sort_order = COALESCE(
    (SELECT MAX(sort_order) + 1 FROM hero_backgrounds WHERE placement = NEW.placement),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı yeni function ile güncelle
DROP TRIGGER IF EXISTS minimal_insert_order_trigger ON hero_backgrounds;

CREATE TRIGGER hero_backgrounds_sort_trigger
  BEFORE INSERT ON hero_backgrounds
  FOR EACH ROW EXECUTE FUNCTION public.hero_backgrounds_sort_order();
