-- Fix Overly Permissive RLS Policy for Orders Table
-- This script removes the "Allow order insertions" policy that bypasses RLS

-- 1. Remove the overly permissive policy
DROP POLICY IF EXISTS "Allow order insertions" ON public.orders;

-- 2. Create a proper policy that requires authentication
CREATE POLICY "Authenticated users can insert orders" ON public.orders
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Users can insert orders with their email (if buyer_email column exists)
  buyer_email = (select auth.email())
  OR
  -- Admins can insert any order
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

-- 3. Verify the fix
SELECT 
  'POLICY STATUS' as status,
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
  AND cmd = 'INSERT'
ORDER BY policyname;

-- 4. Summary
SELECT 
  'SECURITY AUDIT COMPLETE' as status,
  'Overly permissive policy removed' as action,
  'Proper authentication required' as result;
