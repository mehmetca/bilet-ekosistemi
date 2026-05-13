-- Sipariş numarası: aynı gün / aynı salon farklı etkinliklerde karışmasın — sıra etkinlik (event_id) bazında.
-- Format: DDMMYYYY-{uuid8}-XXXXXX (örn. 13052026-d338019a-000001)

CREATE OR REPLACE FUNCTION public.generate_order_number(p_event_id uuid DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_part TEXT;
  v_sequence INT;
  v_event_tag TEXT;
BEGIN
  v_date_part := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');

  -- Eski davranış: event_id yoksa günlük global sıra (DDMMYYYY-XXXXXX)
  IF p_event_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('kurdevents_order_number_global:' || v_date_part));

    SELECT COALESCE(MAX(substring(order_number FROM '[0-9]{6}$')::int), 0) + 1
      INTO v_sequence
      FROM public.orders
      WHERE order_number ~ ('^' || v_date_part || '-[0-9]{6}$');

    RETURN v_date_part || '-' || LPAD(v_sequence::TEXT, 6, '0');
  END IF;

  v_event_tag := lower(substring(replace(p_event_id::text, '-', ''), 1, 8));

  PERFORM pg_advisory_xact_lock(hashtext('kurdevents_order_number:' || v_date_part || ':' || p_event_id::text));

  SELECT COALESCE(MAX((regexp_match(order_number, '-([0-9]{6})$'))[1]::int), 0) + 1
    INTO v_sequence
    FROM public.orders
    WHERE event_id = p_event_id
      AND order_number ~ ('^' || v_date_part || '-' || v_event_tag || '-[0-9]{6}$');

  RETURN v_date_part || '-' || v_event_tag || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_order_number(uuid) IS 'Sipariş no: etkinlik bazında günlük sıra; aynı mekanda farklı seanslar birbirine karışmaz.';

-- Trigger: her INSERT için etkinlik kimliğini kullan
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_order_number(NEW.event_id);
  END IF;
  RETURN NEW;
END;
$$;
