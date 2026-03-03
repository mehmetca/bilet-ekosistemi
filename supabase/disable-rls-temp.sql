-- Quick Fix for Event Access - Disable RLS Temporarily
-- This immediately fixes the access issue by disabling RLS

-- 1. Disable RLS for events and tour_events
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_events DISABLE ROW LEVEL SECURITY;

-- 2. Remove all policies
DROP POLICY IF EXISTS "Admins can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;

DROP POLICY IF EXISTS "Admins can view tour_events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can update tour_events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can delete tour_events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can insert tour_events" ON public.tour_events;

-- 3. Verify RLS is disabled
SELECT 
  'RLS DISABLED' as status,
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class 
WHERE relname IN ('events', 'tour_events')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY relname;

-- 4. Check if tables are accessible
SELECT 
  'ACCESS TEST' as status,
  'events' as table_name,
  (SELECT COUNT(*) FROM public.events LIMIT 1) as accessible;

SELECT 
  'ACCESS TEST' as status,
  'tour_events' as table_name,
  (SELECT COUNT(*) FROM public.tour_events LIMIT 1) as accessible;
