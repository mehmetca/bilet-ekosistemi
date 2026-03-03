-- RLS Performance Optimization - Fixed Version
-- Fixing suboptimal query performance by replacing auth.<function>() with (select auth.<function>())

-- 1. Check all tables with RLS policies that might have performance issues
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE 
    WHEN qual::text LIKE '%auth.%' OR qual::text LIKE '%current_setting%' THEN 'PERFORMANCE ISSUE'
    WHEN with_check::text LIKE '%auth.%' OR with_check::text LIKE '%current_setting%' THEN 'PERFORMANCE ISSUE'
    ELSE 'OPTIMIZED'
  END as performance_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND (qual::text LIKE '%auth.%' OR qual::text LIKE '%current_setting%' 
       OR with_check::text LIKE '%auth.%' OR with_check::text LIKE '%current_setting%')
ORDER BY tablename, policyname;

-- 2. Fix artists table policies
DROP POLICY IF EXISTS "Admins can delete artists" ON public.artists;
DROP POLICY IF EXISTS "Admins can insert artists" ON public.artists;
DROP POLICY IF EXISTS "Admins can update artists" ON public.artists;
DROP POLICY IF EXISTS "Admins can select artists" ON public.artists;

-- Create optimized artists policies
CREATE POLICY "Admins can delete artists" ON public.artists
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert artists" ON public.artists
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update artists" ON public.artists
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can select artists" ON public.artists
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

-- 3. Fix events table policies
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;

-- Create optimized events policies
CREATE POLICY "Admins can delete events" ON public.events
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert events" ON public.events
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update events" ON public.events
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

-- 4. Fix tickets table policies
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON public.tickets;

-- Create optimized tickets policies
CREATE POLICY "Admins can delete tickets" ON public.tickets
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert tickets" ON public.tickets
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update tickets" ON public.tickets
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can manage tickets" ON public.tickets
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

-- 5. Fix orders table policies
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

-- Create optimized orders policies
CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert orders" ON public.orders
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can view all orders" ON public.orders
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Users can insert own orders" ON public.orders
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view own orders" ON public.orders
FOR SELECT 
USING (true);

-- 6. Fix tour_events table policies
DROP POLICY IF EXISTS "Admins can delete tour events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can insert tour events" ON public.tour_events;
DROP POLICY IF EXISTS "Admins can update tour events" ON public.tour_events;

-- Create optimized tour_events policies
CREATE POLICY "Admins can delete tour events" ON public.tour_events
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert tour events" ON public.tour_events
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update tour events" ON public.tour_events
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

-- 7. Fix news table policies
DROP POLICY IF EXISTS "Admins can delete news" ON public.news;
DROP POLICY IF EXISTS "Admins can insert news" ON public.news;
DROP POLICY IF EXISTS "Admins can update news" ON public.news;

-- Create optimized news policies
CREATE POLICY "Admins can delete news" ON public.news
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert news" ON public.news
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update news" ON public.news
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

-- 8. Fix user_roles table policies
DROP POLICY IF EXISTS "Kullanıcı rolleri admin ekleyebilir" ON public.user_roles;
DROP POLICY IF EXISTS "Kullanıcı rolleri admin güncelleyebilir" ON public.user_roles;
DROP POLICY IF EXISTS "Kullanıcı rolleri admin silebilir" ON public.user_roles;

-- Create optimized user_roles policies
CREATE POLICY "Kullanıcı rolleri admin ekleyebilir" ON public.user_roles
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Kullanıcı rolleri admin güncelleyebilir" ON public.user_roles
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

CREATE POLICY "Kullanıcı rolleri admin silebilir" ON public.user_roles
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = (select auth.uid()) 
    AND role = 'admin'
  )
);

-- 9. Verify optimization
SELECT 
  schemaname,
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
ORDER BY tablename, policyname;
