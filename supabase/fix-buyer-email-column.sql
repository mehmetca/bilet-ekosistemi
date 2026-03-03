-- Fix buyer_email Column Issue in Orders Table
-- The column exists in schema but not in cache - let's fix this

-- 1. Check if buyer_email column actually exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
  AND column_name = 'buyer_email';

-- 2. If column doesn't exist, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND table_schema = 'public' 
      AND column_name = 'buyer_email'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN buyer_email TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added buyer_email column to orders table';
  ELSE
    RAISE NOTICE 'buyer_email column already exists';
  END IF;
END $$;

-- 3. Update RLS policies to allow buyer_email usage
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Orders are publicly readable" ON public.orders;

-- Create policies that allow buyer_email
CREATE POLICY "Admins can insert orders" ON public.orders
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Admins can insert any order
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

CREATE POLICY "Users can insert own orders" ON public.orders
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Users can insert orders with their email
  buyer_email = (select auth.email())
  OR
  -- Admins can insert any order
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

CREATE POLICY "Orders are publicly readable" ON public.orders
FOR SELECT 
TO anon
USING (true);

CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 4. Verify the column and policies
SELECT 
  'FINAL VERIFICATION' as status,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
  AND column_name = 'buyer_email'

UNION ALL

SELECT 
  'POLICIES CREATED' as status,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
ORDER BY status, policyname;
