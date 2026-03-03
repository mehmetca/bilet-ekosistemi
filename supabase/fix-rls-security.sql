-- Security Fix for RLS Policies - Remove Overly Permissive Policies
-- Fix the "Users can insert own orders" policy that bypasses RLS

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

-- 2. Check for other overly permissive policies
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  CASE 
    WHEN qual IS NOT NULL AND qual::text = 'true' THEN 'OVERLY PERMISSIVE - SELECT'
    WHEN with_check IS NOT NULL AND with_check::text = 'true' THEN 'OVERLY PERMISSIVE - INSERT/UPDATE'
    ELSE 'OK'
  END as security_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    (qual IS NOT NULL AND qual::text = 'true')
    OR (with_check IS NOT NULL AND with_check::text = 'true')
  )
ORDER BY tablename, policyname;

-- 3. Verify the fix
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
  AND policyname = 'Users can insert own orders';
