-- Kontrolör başvuru akışı
CREATE TABLE IF NOT EXISTS public.controller_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ NULL,
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_controller_requests_status ON public.controller_requests(status);
CREATE INDEX IF NOT EXISTS idx_controller_requests_created_at ON public.controller_requests(created_at DESC);

ALTER TABLE public.controller_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Controller requests owner read" ON public.controller_requests;
CREATE POLICY "Controller requests owner read"
  ON public.controller_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Controller requests owner insert" ON public.controller_requests;
CREATE POLICY "Controller requests owner insert"
  ON public.controller_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Controller requests admin manage" ON public.controller_requests;
CREATE POLICY "Controller requests admin manage"
  ON public.controller_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

