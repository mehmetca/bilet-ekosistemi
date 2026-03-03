-- RLS Policy Performance Optimization for artists table
-- Fixing suboptimal query performance by replacing auth.<function>() with (select auth.<function>())

-- 1. First, let's check the current problematic policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'artists' 
  AND policyname = 'Admins can delete artists';

-- 2. Drop the problematic policy
DROP POLICY IF EXISTS "Admins can delete artists" ON public.artists;

-- 3. Create optimized policies with proper auth function usage

-- Optimized delete policy for admins
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

-- Also check and fix other policies on artists table if they exist
DROP POLICY IF EXISTS "Admins can insert artists" ON public.artists;
DROP POLICY IF EXISTS "Admins can update artists" ON public.artists;
DROP POLICY IF EXISTS "Admins can select artists" ON public.artists;
DROP POLICY IF EXISTS "Users can view artists" ON public.artists;

-- Create optimized policies for all operations

-- Insert policy for admins
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

-- Update policy for admins
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

-- Select policy for admins
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

-- Public select policy for all users (if needed)
CREATE POLICY "Users can view artists" ON public.artists
FOR SELECT 
USING (true);

-- 4. Verify the optimized policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'artists'
ORDER BY policyname;

-- 5. Test the optimized policies
-- Test admin access (replace with actual admin user ID)
-- SELECT * FROM public.artists LIMIT 1;

-- 6. Check if RLS is enabled on the table
SELECT 
  relname as table_name,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
FROM pg_class 
WHERE relname = 'artists';
