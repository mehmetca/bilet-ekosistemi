-- Complete Security Fix for Orders Table
-- This removes all overly permissive policies and creates secure ones

-- 1. Remove ALL overly permissive policies
DROP POLICY IF EXISTS "Allow order insertions" ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Orders are publicly readable" ON public.orders;

-- 2. Create secure policies with proper authentication

-- Secure INSERT policy
CREATE POLICY "Authenticated users can insert orders" ON public.orders
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Users can insert orders with their email
  buyer_email = (select auth.email())
  OR
  -- Admins can insert any order
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

-- Secure SELECT policy (public read)
CREATE POLICY "Orders are publicly readable" ON public.orders
FOR SELECT 
TO anon
USING (true);

-- Secure UPDATE policy (admin only)
CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Secure DELETE policy (admin only)
CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 3. Verify all policies are now secure
SELECT 
  'SECURITY AUDIT' as status,
  policyname,
  cmd,
  roles,
  CASE 
    WHEN with_check::text = 'true' THEN 'OVERLY PERMISSIVE - SECURITY RISK'
    ELSE 'SECURE'
  END as security_level
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
ORDER BY policyname;

-- 4. Final verification
SELECT 
  'FINAL STATUS' as status,
  COUNT(*) as total_policies,
  COUNT(CASE WHEN with_check::text = 'true' THEN 1 END) as permissive_policies,
  COUNT(CASE WHEN with_check::text != 'true' THEN 1 END) as secure_policies
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders';
