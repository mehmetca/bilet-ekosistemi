-- Quick Fix for Missing Columns in Orders Table
-- This script adds buyer_name and buyer_email columns if they don't exist

-- 1. Add buyer_name column if missing
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_name TEXT NOT NULL DEFAULT '';

-- 2. Add buyer_email column if missing
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_email TEXT NOT NULL DEFAULT '';

-- 3. Remove problematic policies
DROP POLICY IF EXISTS "Allow order insertions" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can insert orders" ON public.orders;

-- 4. Create secure INSERT policy
CREATE POLICY "Users can insert orders" ON public.orders
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Users can insert orders with their email
  buyer_email = (select auth.email())
  OR
  -- Admins can insert any order
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

-- 5. Verify columns were added
SELECT 
  'COLUMN STATUS' as status,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
  AND column_name IN ('buyer_name', 'buyer_email')
ORDER BY column_name;
