-- Fixed Security Policy for Orders Table
-- Corrected version with proper column names

-- 1. Fix the problematic orders policy
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;

-- Create a proper policy that allows users to insert their own orders
CREATE POLICY "Users can insert own orders" ON public.orders
FOR INSERT 
WITH CHECK (
  -- Allow users to insert orders where buyer_email matches their authenticated email
  buyer_email = (select auth.email())
  OR
  -- Allow admins to insert any order
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

-- 2. Also fix the overly permissive anonymous policies
DROP POLICY IF EXISTS "Siparişler eklenebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler güncellenebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler silinebilir" ON public.orders;

-- Create secure policies for authenticated users
CREATE POLICY "Authenticated users can insert orders" ON public.orders
FOR INSERT 
TO authenticated
WITH CHECK (
  buyer_email = (select auth.email())
  OR
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

CREATE POLICY "Users can update own orders" ON public.orders
FOR UPDATE 
TO authenticated
USING (
  buyer_email = (select auth.email())
  OR
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
)
WITH CHECK (
  buyer_email = (select auth.email())
  OR
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 3. Keep the public read policy (this is intentional)
-- CREATE POLICY "Siparişler herkes tarafından okunabilir" ON public.orders
--   FOR SELECT TO anon USING (true);

-- 4. Verify the fix
SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
ORDER BY policyname;
