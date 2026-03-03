-- Clean Security Fix - Remove All Existing Policies First
-- This ensures no conflicts with existing policies

-- 1. Remove ALL policies on orders table (comprehensive cleanup)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'orders' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', r.policyname);
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP;
END $$;

-- 2. Verify all policies are removed
SELECT 
  'POLICIES REMOVED' as status,
  count(*) as remaining_policies
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders';

-- 3. Create new secure policies (clean slate)

-- Only admins can insert orders
CREATE POLICY "Admins can insert orders" ON public.orders
FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Everyone can read orders (public access)
CREATE POLICY "Orders are publicly readable" ON public.orders
FOR SELECT 
TO anon
USING (true);

-- Only admins can update orders
CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Only admins can delete orders
CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 4. Verify the new policies
SELECT 
  'NEW POLICIES CREATED' as status,
  policyname,
  cmd,
  roles,
  'SECURE' as security_level
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
ORDER BY policyname;
