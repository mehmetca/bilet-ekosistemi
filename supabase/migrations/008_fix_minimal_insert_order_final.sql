-- minimal_insert_order function'ı son kez güvenli hale getirme
DROP FUNCTION IF EXISTS public.minimal_insert_order() CASCADE;

-- Tamamen sade versiyon (SECURITY DEFINER olmadan)
CREATE OR REPLACE FUNCTION public.minimal_insert_order()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sort_order = COALESCE(
    (SELECT MAX(sort_order) + 1 FROM hero_backgrounds WHERE placement = NEW.placement),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı yeniden oluştur
DROP TRIGGER IF EXISTS minimal_insert_order_trigger ON hero_backgrounds;
CREATE TRIGGER minimal_insert_order_trigger
  BEFORE INSERT ON hero_backgrounds
  FOR EACH ROW EXECUTE FUNCTION public.minimal_insert_order();
