-- Comprehensive RLS Performance Optimization for All Tables
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

-- 2. Fix events table policies if they exist
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Users can view events" ON public.events;

-- Create optimized policies for events table
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

CREATE POLICY "Users can view events" ON public.events
FOR SELECT 
USING (true);

-- 3. Fix tickets table policies if they exist
DROP POLICY IF EXISTS "Admins can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can view tickets" ON public.tickets;

-- Create optimized policies for tickets table
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

CREATE POLICY "Users can view tickets" ON public.tickets
FOR SELECT 
USING (true);

-- 4. Fix orders table policies if they exist
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders" ON public.orders;

-- Create optimized policies for orders table
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

CREATE POLICY "Users can view orders" ON public.orders
FOR SELECT 
USING (true);

-- 5. Verify all optimized policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE 
    WHEN qual::text LIKE '%auth.%' OR qual::text LIKE '%current_setting%' THEN 'STILL NEEDS OPTIMIZATION'
    WHEN with_check::text LIKE '%auth.%' OR with_check::text LIKE '%current_setting%' THEN 'STILL NEEDS OPTIMIZATION'
    ELSE 'OPTIMIZED'
  END as performance_status
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
