-- Taslak etkinlikler anonim (public) okumada görünmesin.
-- Admin ve organizatör politikaları değişmeden kalır.

DROP POLICY IF EXISTS "Public read approved events" ON public.events;
CREATE POLICY "Public read approved events"
  ON public.events
  FOR SELECT
  USING (is_approved = true AND COALESCE(is_draft, false) = false);
