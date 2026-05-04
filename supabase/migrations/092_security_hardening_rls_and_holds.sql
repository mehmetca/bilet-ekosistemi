-- Security hardening:
-- 1) Organizer event updates must keep ownership and cannot self-approve.
-- 2) Organizer seating-plan writes are scoped to plans attached to own events.
-- 3) Expired seat holds overwrite the previous owner and sold seats cannot be held.

DROP POLICY IF EXISTS "Organizer can update own events" ON public.events;
CREATE POLICY "Organizer can update own events" ON public.events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'organizer'
    )
    AND created_by_user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'organizer'
    )
    AND created_by_user_id = auth.uid()
    AND COALESCE(is_approved, false) = false
  );

DROP POLICY IF EXISTS "Organizers manage seating_plans" ON public.seating_plans;
CREATE POLICY "Organizers manage seating_plans" ON public.seating_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'organizer'
      WHERE e.seating_plan_id = seating_plans.id
        AND e.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'organizer'
      WHERE e.seating_plan_id = seating_plans.id
        AND e.created_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers manage seating_plan_sections" ON public.seating_plan_sections;
CREATE POLICY "Organizers manage seating_plan_sections" ON public.seating_plan_sections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'organizer'
      WHERE e.seating_plan_id = seating_plan_sections.seating_plan_id
        AND e.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'organizer'
      WHERE e.seating_plan_id = seating_plan_sections.seating_plan_id
        AND e.created_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers manage seating_plan_rows" ON public.seating_plan_rows;
CREATE POLICY "Organizers manage seating_plan_rows" ON public.seating_plan_rows
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.seating_plan_sections s
      JOIN public.events e ON e.seating_plan_id = s.seating_plan_id
      JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'organizer'
      WHERE s.id = seating_plan_rows.section_id
        AND e.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.seating_plan_sections s
      JOIN public.events e ON e.seating_plan_id = s.seating_plan_id
      JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'organizer'
      WHERE s.id = seating_plan_rows.section_id
        AND e.created_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers manage seats" ON public.seats;
CREATE POLICY "Organizers manage seats" ON public.seats
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.seating_plan_rows r
      JOIN public.seating_plan_sections s ON s.id = r.section_id
      JOIN public.events e ON e.seating_plan_id = s.seating_plan_id
      JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'organizer'
      WHERE r.id = seats.row_id
        AND e.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.seating_plan_rows r
      JOIN public.seating_plan_sections s ON s.id = r.section_id
      JOIN public.events e ON e.seating_plan_id = s.seating_plan_id
      JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'organizer'
      WHERE r.id = seats.row_id
        AND e.created_by_user_id = auth.uid()
    )
  );

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

  IF EXISTS (
    SELECT 1 FROM public.order_seats
    WHERE event_id = p_event_id AND seat_id = p_seat_id
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

  IF v_existing.held_until <= v_now THEN
    UPDATE public.seat_holds
    SET user_id = p_user_id,
        session_id = p_session_id,
        held_until = v_new_until
    WHERE id = v_existing.id;
    RETURN TRUE;
  END IF;

  IF (p_user_id IS NOT NULL AND v_existing.user_id = p_user_id)
     OR (p_session_id IS NOT NULL AND v_existing.session_id = p_session_id) THEN
    UPDATE public.seat_holds
    SET user_id = p_user_id,
        session_id = p_session_id,
        held_until = v_new_until
    WHERE id = v_existing.id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
