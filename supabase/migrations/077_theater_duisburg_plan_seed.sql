-- Theater Duisburg (görsel plan) için oturum planı şablonu.
-- Bir mekanda "Theater Duisburg" planını oluşturmak için: create_theater_duisburg_plan(venue_id) çağrılır.

CREATE OR REPLACE FUNCTION public.create_theater_duisburg_plan(p_venue_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_section_id UUID;
  v_row_id UUID;
  v_section_name TEXT;
  v_row_count INT;
  v_seats_per_row INT;
  v_sort INT := 0;
  r INT;
  s INT;
BEGIN
  IF p_venue_id IS NULL THEN
    RAISE EXCEPTION 'venue_id is required';
  END IF;

  INSERT INTO public.seating_plans (venue_id, name)
  VALUES (p_venue_id, 'Theater Duisburg')
  RETURNING id INTO v_plan_id;

  FOR v_section_name, v_row_count, v_seats_per_row IN
    SELECT f.section_name, f.row_count, f.seats_per_row
    FROM (VALUES
      ('1. PARKETT', 10, 16),
      ('2. PARKETT', 7, 20),
      ('3. PARKETT', 6, 24),
      ('PARKETT', 4, 20),
      ('PARKETT LOGEN LINKS', 8, 4),
      ('PARKETT LOGEN RECHTS', 8, 4),
      ('1. RANG LINKS', 5, 6),
      ('1. RANG RECHTS', 5, 6),
      ('2. RANG LINKS', 3, 5),
      ('2. RANG RECHTS', 3, 5),
      ('MITTE LINKS', 9, 14),
      ('MITTE RECHTS', 9, 14)
    ) AS f(section_name, row_count, seats_per_row)
  LOOP
    v_sort := v_sort + 1;
    INSERT INTO public.seating_plan_sections (seating_plan_id, name, sort_order)
    VALUES (v_plan_id, v_section_name, v_sort)
    RETURNING id INTO v_section_id;

    FOR r IN 1..v_row_count LOOP
      INSERT INTO public.seating_plan_rows (section_id, row_label, sort_order)
      VALUES (v_section_id, r::TEXT, r)
      RETURNING id INTO v_row_id;

      FOR s IN 1..v_seats_per_row LOOP
        INSERT INTO public.seats (row_id, seat_label)
        VALUES (v_row_id, s::TEXT);
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_plan_id;
END;
$$;

COMMENT ON FUNCTION public.create_theater_duisburg_plan(UUID) IS
  'Mekan için Theater Duisburg oturum planını (bölümler, sıralar, koltuklar) oluşturur. Görsel plan (image overlay) ile eşleşir.';
