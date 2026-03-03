-- Venues RLS: user_roles tablosuna göre admin kontrolü
-- auth.jwt() -> 'user_data' rolü JWT'de olmayabilir; user_roles kullan

DROP POLICY IF EXISTS "Admins can manage venues" ON public.venues;

CREATE POLICY "Admins can manage venues" ON public.venues
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );
