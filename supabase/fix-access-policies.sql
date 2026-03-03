-- Fix Access Issues for Events and Tour Events
-- This creates proper public access policies

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;

DROP POLICY IF EXISTS "Admins can view tour_events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can update tour_events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can delete tour_events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can insert tour_events" ON public.tour_events;

-- 2. Enable RLS if not enabled
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_events ENABLE ROW LEVEL SECURITY;

-- 3. Create public read policies for events
CREATE POLICY "Events are publicly readable" ON public.events
FOR SELECT 
TO anon
USING (true);

CREATE POLICY "Authenticated users can insert events" ON public.events
FOR INSERT 
TO authenticated
WITH CHECK (
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
);

CREATE POLICY "Admins can update events" ON public.events
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));

CREATE POLICY "Admins can delete events" ON public.events
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));

-- 4. Create public read policies for tour_events
CREATE POLICY "Tour events are publicly readable" ON public.tour_events
FOR SELECT 
TO anon
USING (true);

CREATE POLICY "Authenticated users can insert tour_events" ON public.tour_events
FOR INSERT 
TO authenticated
WITH CHECK (
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
);

CREATE POLICY "Admins can update tour_events" ON public.tour_events
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));

CREATE POLICY "Admins can delete tour_events" ON public.tour_events
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));

-- 5. Verify policies
SELECT 
  'POLICIES CREATED' as status,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('events', 'tour_events')
ORDER BY tablename, policyname;
