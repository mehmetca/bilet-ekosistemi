-- Organizatör rolü ve etkinlik onay sistemi
-- 1. organizer_requests: Site üzerinden organizatör olmak isteyen kullanıcılar
CREATE TABLE IF NOT EXISTS public.organizer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_organizer_requests_user_id ON public.organizer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_requests_status ON public.organizer_requests(status);

-- 2. events tablosuna organizatör ve onay alanları
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;

-- Mevcut etkinlikler admin tarafından oluşturulmuş sayılır, onaylı
UPDATE public.events SET is_approved = true WHERE is_approved IS NULL;

-- 3. user_roles'a organizer rolü eklenebilir (zaten role TEXT, 'organizer' değeri kabul edilir)
-- RLS: admin organizer_requests görüntüleyebilir ve güncelleyebilir
ALTER TABLE public.organizer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage organizer requests" ON public.organizer_requests;
CREATE POLICY "Admin can manage organizer requests" ON public.organizer_requests
  FOR ALL
  USING ((SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') IS NOT NULL)
  WITH CHECK ((SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') IS NOT NULL);

-- Kullanıcı kendi talebini görebilir
DROP POLICY IF EXISTS "User can view own organizer request" ON public.organizer_requests;
CREATE POLICY "User can view own organizer request" ON public.organizer_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- Kullanıcı kendi talebini oluşturabilir (pending)
DROP POLICY IF EXISTS "User can create own organizer request" ON public.organizer_requests;
CREATE POLICY "User can create own organizer request" ON public.organizer_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- 4. events: Organizatör kendi etkinliklerini ekleyebilir/güncelleyebilir
-- Admin politikaları mevcut migration'larda tanımlı
-- Organizatör sadece created_by_user_id = auth.uid() ile insert edebilir
DROP POLICY IF EXISTS "Organizer can insert own events" ON public.events;
CREATE POLICY "Organizer can insert own events" ON public.events
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'organizer')
    AND created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Organizer can update own events" ON public.events;
CREATE POLICY "Organizer can update own events" ON public.events
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'organizer')
    AND created_by_user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'organizer')
  );

DROP POLICY IF EXISTS "Organizer can delete own events" ON public.events;
CREATE POLICY "Organizer can delete own events" ON public.events
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'organizer')
    AND created_by_user_id = auth.uid()
  );

-- Admin INSERT policy: created_by_user_id NULL veya admin kendi id'si olabilir
-- Mevcut "Admins can insert events" policy'si admin için yeterli (başka migration'da)
