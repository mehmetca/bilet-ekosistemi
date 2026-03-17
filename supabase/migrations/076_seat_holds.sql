-- Geçici koltuk rezervasyonları (seat holds): kullanıcı koltuğu seçtiğinde kısa süreliğine rezerve et.
-- Amaç: Aynı koltuğu iki kişinin aynı anda seçip ödeme ekranına kadar gelmesini engellemek.
-- Nihai satış yine order_seats.seat_id UNIQUE constraint'i ile garanti altındadır.

CREATE TABLE IF NOT EXISTS public.seat_holds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  session_id TEXT NULL,
  held_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Aynı anda bir koltuk için yalnızca tek aktif hold kaydı olsun.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seat_holds_seat ON public.seat_holds (seat_id);

CREATE INDEX IF NOT EXISTS idx_seat_holds_event ON public.seat_holds (event_id);
CREATE INDEX IF NOT EXISTS idx_seat_holds_held_until ON public.seat_holds (held_until);

COMMENT ON TABLE public.seat_holds IS 'Geçici koltuk rezervasyonları (5 dk gibi kısa süreler için). Aynı koltuğu iki kişinin aynı anda seçmesini engeller.';
COMMENT ON COLUMN public.seat_holds.held_until IS 'Bu zamana kadar koltuk rezerve; süre geçerse rezervasyon yok sayılır ve koltuk serbesttir.';

-- RLS: Yalnızca service_role / backend yönetir; kullanıcı direkt bu tabloya yazmaz.
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

-- Tek bir koltuğu atomik olarak rezerve eden fonksiyon.
-- Dönüş: true = hold alındı; false = başkası aktif olarak tutuyor.
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
  -- En azından user_id veya session_id dolu olmalı; tamamen anonim hold tutma.
  IF p_user_id IS NULL AND (p_session_id IS NULL OR length(trim(p_session_id)) = 0) THEN
    RAISE EXCEPTION 'hold_seat: user_id or session_id required';
  END IF;

  -- Koltuğa ait satır için row-level lock al.
  SELECT * INTO v_existing
  FROM public.seat_holds
  WHERE seat_id = p_seat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Hiç hold yoksa: yeni kayıt oluştur.
    INSERT INTO public.seat_holds (event_id, seat_id, user_id, session_id, held_until)
    VALUES (p_event_id, p_seat_id, p_user_id, p_session_id, v_new_until);
    RETURN TRUE;
  END IF;

  -- Mevcut hold süresi dolmuşsa veya aynı kullanıcı / aynı session ise: devral ve süreyi yenile.
  IF v_existing.held_until <= v_now
     OR (p_user_id IS NOT NULL AND v_existing.user_id = p_user_id)
     OR (p_session_id IS NOT NULL AND v_existing.session_id = p_session_id) THEN
    UPDATE public.seat_holds
    SET event_id = p_event_id,
        user_id = COALESCE(p_user_id, user_id),
        session_id = COALESCE(p_session_id, session_id),
        held_until = v_new_until
    WHERE id = v_existing.id;
    RETURN TRUE;
  END IF;

  -- Aksi halde: başka biri aktif olarak tutuyor.
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.hold_seat(UUID, UUID, UUID, TEXT, INTEGER)
  IS 'Koltuk için kısa süreli (örn. 5 dk) rezervasyon tutar; aynı anda iki farklı kullanıcıya hold verilmesini engeller.';

-- Koltuk hold''unu serbest bırak (kullanıcı koltuğu bıraktığında veya sepeti temizlediğinde).
CREATE OR REPLACE FUNCTION public.release_seat_hold(
  p_seat_id UUID,
  p_user_id UUID,
  p_session_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.seat_holds
  WHERE seat_id = p_seat_id
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_user_id IS NULL AND p_session_id IS NOT NULL AND session_id = p_session_id)
    );
END;
$$;

COMMENT ON FUNCTION public.release_seat_hold(UUID, UUID, TEXT)
  IS 'Koltuk için tutulan geçici rezervasyonu (seat_holds) bırakır.';

