-- event_reminders: SELECT sadece admin/controller için (e-posta listesi gizliliği)
DROP POLICY IF EXISTS "event_reminders_select" ON public.event_reminders;
CREATE POLICY "event_reminders_select" ON public.event_reminders
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );
