-- event_views ve purchase_intents politikalarını idempotent yap (zaten varsa drop et, sonra oluştur)
-- 028'de policy "already exists" hatası alındığında bu migration ile düzeltilebilir

DROP POLICY IF EXISTS "Anyone can insert event_views" ON public.event_views;
CREATE POLICY "Anyone can insert event_views" ON public.event_views
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert purchase_intents" ON public.purchase_intents;
CREATE POLICY "Anyone can insert purchase_intents" ON public.purchase_intents
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can select event_views" ON public.event_views;
CREATE POLICY "Admins can select event_views" ON public.event_views
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

DROP POLICY IF EXISTS "Admins can select purchase_intents" ON public.purchase_intents;
CREATE POLICY "Admins can select purchase_intents" ON public.purchase_intents
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );
