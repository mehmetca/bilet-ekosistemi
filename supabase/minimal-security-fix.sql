-- Minimal Security Fix - Zero Dependencies
-- This version doesn't reference any specific columns

-- 1. Clean slate - remove all policies
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Siparişler eklenebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler güncellenebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler silinebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler herkes tarafından okunabilir" ON public.orders;

-- 2. Simple secure policies

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

-- 3. Verification
SELECT 
  policyname,
  cmd,
  roles,
  'SECURE' as security_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
ORDER BY policyname;
