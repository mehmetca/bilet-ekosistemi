-- Cache temizleme ve function yeniden oluşturma
-- Önce function'ı tamamen drop et
DROP FUNCTION IF EXISTS public.minimal_insert_order() CASCADE;

-- Bekle ve yeniden oluştur
CREATE OR REPLACE FUNCTION public.minimal_insert_order()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sort_order = COALESCE(
    (SELECT MAX(sort_order) + 1 FROM hero_backgrounds WHERE placement = NEW.placement),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function'ı yeniden drop et (cache refresh)
DROP FUNCTION IF EXISTS public.minimal_insert_order() CASCADE;

-- Son olarak sade versiyon oluştur
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
