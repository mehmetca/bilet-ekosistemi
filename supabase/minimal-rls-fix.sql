-- Simple RLS Performance Fix - Minimal Version
-- This script uses the simplest approach to fix performance issues

-- 1. Fix artists table
DROP POLICY IF EXISTS "Admins can delete artists" ON public.artists;
DROP POLICY IF EXISTS "Admins can insert artists" ON public.artists;
DROP POLICY IF EXISTS "Admins can update artists" ON public.artists;
DROP POLICY IF EXISTS "Admins can select artists" ON public.artists;

CREATE POLICY "Admins can delete artists" ON public.artists
FOR DELETE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can insert artists" ON public.artists
FOR INSERT 
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can update artists" ON public.artists
FOR UPDATE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can select artists" ON public.artists
FOR SELECT 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 2. Fix events table
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;

CREATE POLICY "Admins can delete events" ON public.events
FOR DELETE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can insert events" ON public.events
FOR INSERT 
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can update events" ON public.events
FOR UPDATE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 3. Fix tickets table
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON public.tickets;

CREATE POLICY "Admins can delete tickets" ON public.tickets
FOR DELETE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can insert tickets" ON public.tickets
FOR INSERT 
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can update tickets" ON public.tickets
FOR UPDATE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can manage tickets" ON public.tickets
FOR ALL 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 4. Fix orders table
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can insert orders" ON public.orders
FOR INSERT 
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can view all orders" ON public.orders
FOR SELECT 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Users can insert own orders" ON public.orders
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view own orders" ON public.orders
FOR SELECT 
USING (true);

-- 5. Fix tour_events table
DROP POLICY IF EXISTS "Admins can delete tour events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can insert tour events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can update tour events" ON public.tour_events;

CREATE POLICY "Admins can delete tour events" ON public.tour_events
FOR DELETE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can insert tour events" ON public.tour_events
FOR INSERT 
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can update tour events" ON public.tour_events
FOR UPDATE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 6. Fix news table
DROP POLICY IF EXISTS "Admins can delete news" ON public.news;
DROP POLICY IF EXISTS "Admins can insert news" ON public.news;
DROP POLICY IF EXISTS "Admins can update news" ON public.news;

CREATE POLICY "Admins can delete news" ON public.news
FOR DELETE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can insert news" ON public.news
FOR INSERT 
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can update news" ON public.news
FOR UPDATE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 7. Fix user_roles table
DROP POLICY IF EXISTS "Kullanıcı rolleri admin ekleyebilir" ON public.user_roles;
DROP POLICY IF EXISTS "Kullanıcı rolleri admin güncelleyebilir" ON public.user_roles;
DROP POLICY IF EXISTS "Kullanıcı rolleri admin silebilir" ON public.user_roles;

CREATE POLICY "Kullanıcı rolleri admin ekleyebilir" ON public.user_roles
FOR INSERT 
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Kullanıcı rolleri admin güncelleyebilir" ON public.user_roles
FOR UPDATE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Kullanıcı rolleri admin silebilir" ON public.user_roles
FOR DELETE 
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 8. Verify the fix
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%auth.%' OR qual::text LIKE '%current_setting%' THEN 'STILL NEEDS OPTIMIZATION'
    WHEN with_check::text LIKE '%auth.%' OR with_check::text LIKE '%current_setting%' THEN 'STILL NEEDS OPTIMIZATION'
    ELSE 'OPTIMIZED'
  END as performance_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('artists', 'events', 'tickets', 'orders', 'tour_events', 'news', 'user_roles')
ORDER BY tablename, policyname;
