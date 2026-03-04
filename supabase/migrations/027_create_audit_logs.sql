-- Denetim kaydı (audit log) - kritik admin işlemleri
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri kaldır (yeniden çalıştırma için)
DROP POLICY IF EXISTS "Admins can read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit_logs" ON public.audit_logs;

-- Sadece admin okuyabilir
CREATE POLICY "Admins can read audit_logs" ON public.audit_logs
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

-- Sadece admin/controller log yazabilir
CREATE POLICY "Admins can insert audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
