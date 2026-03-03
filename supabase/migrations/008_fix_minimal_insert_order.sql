-- minimal_insert_order function'ı güvenli hale getirme
DROP FUNCTION IF EXISTS public.minimal_insert_order() CASCADE;

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
