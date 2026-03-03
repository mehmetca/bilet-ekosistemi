-- Quick Policy Cleanup - Simple and Direct
-- Remove existing policies and create new ones

-- 1. Check existing policies first
SELECT 
  'EXISTING POLICIES' as action,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
ORDER BY policyname;

-- 2. Remove specific existing policies by name
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Orders are publicly readable" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Siparişler eklenebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler güncellenebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler silinebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler herkes tarafından okunabilir" ON public.orders;

-- 3. Create new secure policies
CREATE POLICY "Admins can insert orders" ON public.orders
FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Orders are publicly readable" ON public.orders
FOR SELECT 
TO anon
USING (true);

CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 4. Final verification
SELECT 
  'FINAL STATUS' as status,
  policyname,
  cmd,
  roles,
  'SECURE' as security_level
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
ORDER BY policyname;
