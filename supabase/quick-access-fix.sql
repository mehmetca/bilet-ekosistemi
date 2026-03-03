-- Quick Fix for Event Access
-- This immediately fixes the access issue

-- 1. Drop all existing policies for events and tour_events
DROP POLICY IF EXISTS "Admins can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;

DROP POLICY IF EXISTS "Admins can view tour_events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can update tour_events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can delete tour_events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can insert tour_events" ON public.tour_events;

-- 2. Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_events ENABLE ROW LEVEL SECURITY;

-- 3. Create simple public read policies
CREATE POLICY "Events are publicly readable" ON public.events
FOR SELECT 
TO anon
USING (true);

CREATE POLICY "Tour events are publicly readable" ON public.tour_events
FOR SELECT 
TO anon
USING (true);

-- 4. Create admin-only write policies
CREATE POLICY "Admins can manage events" ON public.events
FOR ALL 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));

CREATE POLICY "Admins can manage tour_events" ON public.tour_events
FOR ALL 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));

-- 5. Verification
SELECT 
  'ACCESS FIXED' as status,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('events', 'tour_events')
ORDER BY tablename, policyname;
