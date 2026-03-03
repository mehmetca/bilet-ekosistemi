-- Disable RLS for Orders - Alternative Method
-- This uses a different approach to disable RLS

-- 1. First, drop all policies
DROP POLICY IF EXISTS "Users can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete their orders" ON public.orders;

-- 2. Create permissive policy for all users
CREATE POLICY "Enable all access" ON public.orders
  FOR ALL USING (true);

-- 3. Enable RLS (but with permissive policy)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
