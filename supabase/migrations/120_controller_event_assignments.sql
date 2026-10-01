CREATE TABLE IF NOT EXISTS public.controller_event_assignments (
  controller_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (controller_user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_controller_event_assignments_event
  ON public.controller_event_assignments(event_id);

COMMENT ON TABLE public.controller_event_assignments IS
  'Etkinlik bazında bilet kontrol yetkisi verilen kontrolörler.';

ALTER TABLE public.controller_event_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage controller event assignments"
  ON public.controller_event_assignments;
CREATE POLICY "Admin can manage controller event assignments"
  ON public.controller_event_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Controller can view own event assignments"
  ON public.controller_event_assignments;
CREATE POLICY "Controller can view own event assignments"
  ON public.controller_event_assignments
  FOR SELECT
  USING (controller_user_id = auth.uid());

INSERT INTO public.controller_event_assignments (controller_user_id, event_id)
SELECT oc.controller_user_id, e.id
FROM public.organizer_controllers oc
JOIN public.events e ON e.created_by_user_id = oc.organizer_user_id
ON CONFLICT (controller_user_id, event_id) DO NOTHING;