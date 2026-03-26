-- Aynı salon farklı etkinliklerde koltuk seçimi karışmasın:
-- hold benzersizliği seat_id yerine (event_id, seat_id) bazında olmalı.

CREATE TABLE IF NOT EXISTS public.seat_holds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  user_id UUID NULL,
  session_id TEXT NULL,
  held_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Bazı ortamlarda public.users tablosu yok; eski bir FK varsa kaldır.
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname
  INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'seat_holds'
    AND con.contype = 'f'
    AND pg_get_constraintdef(con.oid) ILIKE '%user_id%';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.seat_holds DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.seat_holds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seat_holds'
      AND policyname = 'Service role manages seat_holds'
  ) THEN
    CREATE POLICY "Service role manages seat_holds"
      ON public.seat_holds FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role')
      WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_seat_holds_seat;
CREATE UNIQUE INDEX IF NOT EXISTS idx_seat_holds_event_seat
  ON public.seat_holds (event_id, seat_id);
CREATE INDEX IF NOT EXISTS idx_seat_holds_event ON public.seat_holds (event_id);
CREATE INDEX IF NOT EXISTS idx_seat_holds_held_until ON public.seat_holds (held_until);

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

CREATE OR REPLACE FUNCTION public.release_seat_hold(
  p_event_id UUID,
  p_seat_id UUID,
  p_user_id UUID,
  p_session_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.seat_holds
  WHERE event_id = p_event_id
    AND seat_id = p_seat_id
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_user_id IS NULL AND p_session_id IS NOT NULL AND session_id = p_session_id)
    );
END;
$$;
