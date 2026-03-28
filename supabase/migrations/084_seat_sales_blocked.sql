-- Koltukları satışa kapat (rezervasyon / satın alma / hold dışında tut)
ALTER TABLE public.seats
  ADD COLUMN IF NOT EXISTS sales_blocked BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.seats.sales_blocked IS
  'True ise koltuk seçilemez ve hold satın alma kabul etmez (ör. teknik, sponsor).';

CREATE OR REPLACE FUNCTION public.hold_seat(
  p_event_id UUID,
  p_seat_id UUID,
  p_user_id UUID,
  p_session_id TEXT,
  p_hold_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_new_until TIMESTAMPTZ := v_now + MAKE_INTERVAL(secs => GREATEST(p_hold_seconds, 60));
  v_existing RECORD;
BEGIN
  IF p_user_id IS NULL AND (p_session_id IS NULL OR length(trim(p_session_id)) = 0) THEN
    RAISE EXCEPTION 'hold_seat: user_id or session_id required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.seats
    WHERE id = p_seat_id AND COALESCE(sales_blocked, false)
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_existing
  FROM public.seat_holds
  WHERE event_id = p_event_id
    AND seat_id = p_seat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.seat_holds (event_id, seat_id, user_id, session_id, held_until)
    VALUES (p_event_id, p_seat_id, p_user_id, p_session_id, v_new_until);
    RETURN TRUE;
  END IF;

  IF v_existing.held_until <= v_now
     OR (p_user_id IS NOT NULL AND v_existing.user_id = p_user_id)
     OR (p_session_id IS NOT NULL AND v_existing.session_id = p_session_id) THEN
    UPDATE public.seat_holds
    SET user_id = COALESCE(p_user_id, user_id),
        session_id = COALESCE(p_session_id, session_id),
        held_until = v_new_until
    WHERE id = v_existing.id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
