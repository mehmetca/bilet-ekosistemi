-- Fix buyer_name Column Issue in Orders Table
-- This script adds the missing buyer_name column if it doesn't exist

-- 1. Check if buyer_name column exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
  AND column_name = 'buyer_name';

-- 2. Add buyer_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND table_schema = 'public' 
      AND column_name = 'buyer_name'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN buyer_name TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added buyer_name column to orders table';
  ELSE
    RAISE NOTICE 'buyer_name column already exists';
  END IF;
END $$;

-- 3. Update RLS policies to include buyer_name
DROP POLICY IF EXISTS "Authenticated users can insert orders" ON public.orders;

-- Create secure INSERT policy with buyer_name support
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

-- 4. Verify the fix
SELECT 
  'COLUMN STATUS' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
  AND column_name IN ('buyer_name', 'buyer_email')
ORDER BY column_name;
