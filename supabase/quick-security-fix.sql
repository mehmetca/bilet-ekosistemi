-- Quick Security Fix for Orders Table
-- Simple fix for the buyer_email column issue

-- 1. Check current orders table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Fix the overly permissive policy
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;

-- Create secure policy with correct column reference
CREATE POLICY "Users can insert own orders" ON public.orders
FOR INSERT 
WITH CHECK (
  -- Users can only insert orders with their own email
  buyer_email = (select auth.email())
  OR
  -- Admins can insert any order
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

-- 3. Remove other overly permissive policies
DROP POLICY IF EXISTS "Siparişler eklenebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler güncellenebilir" ON public.orders;
DROP POLICY IF EXISTS "Siparişler silinebilir" ON public.orders;

-- 4. Create proper secure policies
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
USING (buyer_email = (select auth.email()))
WITH CHECK (buyer_email = (select auth.email()));

CREATE POLICY "Admins can manage orders" ON public.orders
FOR ALL 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 5. Verify the fix
SELECT 
  'ORDERS SECURITY STATUS' as status,
  policyname,
  cmd,
  CASE 
    WHEN with_check::text = 'true' THEN 'OVERLY PERMISSIVE - SECURITY RISK'
    WHEN qual::text = 'true' THEN 'OVERLY PERMISSIVE - SECURITY RISK'
    ELSE 'SECURE'
  END as security_level
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
ORDER BY policyname;
