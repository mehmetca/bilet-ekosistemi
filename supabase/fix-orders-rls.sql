-- Fix RLS for Orders Table - Allow Admin Access
-- This ensures admin users can see orders in management panel

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete their orders" ON public.orders;

-- 2. Create admin-friendly policies
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (
    (SELECT auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

CREATE POLICY "Admins can insert orders" ON public.orders
  FOR INSERT WITH CHECK (
    (SELECT auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE USING (
    (SELECT auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

-- 3. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Verify policies
SELECT 
  'POLICIES UPDATED' as status,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'orders';
