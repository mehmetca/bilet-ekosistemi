-- Kapıda (gişede) bilet satma yetkisi: kontrolörün satış karşılığı.
-- Rol 'gate_sales'; hangi etkinlikte satabilececi satır satır atanır.

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'controller', 'organizer', 'gate_sales'));

CREATE TABLE IF NOT EXISTS public.gate_sales_event_assignments (
  gate_sales_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (gate_sales_user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_gate_sales_event_assignments_event
  ON public.gate_sales_event_assignments(event_id);

COMMENT ON TABLE public.gate_sales_event_assignments IS
  'Etkinlik bazında kapıda bilet satma yetkisi verilen gişe görevlileri.';

ALTER TABLE public.gate_sales_event_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage gate sales event assignments"
  ON public.gate_sales_event_assignments;
CREATE POLICY "Admin can manage gate sales event assignments"
  ON public.gate_sales_event_assignments
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

DROP POLICY IF EXISTS "Gate sales staff can view own event assignments"
  ON public.gate_sales_event_assignments;
CREATE POLICY "Gate sales staff can view own event assignments"
  ON public.gate_sales_event_assignments
  FOR SELECT
  USING (gate_sales_user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
