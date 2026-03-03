-- Complete Fix for buyer_name and buyer_email Columns
-- This script ensures both columns exist and updates RLS policies

-- 1. Add missing columns if they don't exist
DO $$
BEGIN
  -- Add buyer_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND table_schema = 'public' 
      AND column_name = 'buyer_name'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN buyer_name TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added buyer_name column';
  END IF;

  -- Add buyer_email column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND table_schema = 'public' 
      AND column_name = 'buyer_email'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN buyer_email TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added buyer_email column';
  END IF;
END $$;

-- 2. Remove all existing policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'orders' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', r.policyname);
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP;
END $$;

-- 3. Create comprehensive secure policies

-- Secure INSERT policy with proper validation
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

-- Public SELECT policy (for basic functionality)
CREATE POLICY "Orders are publicly readable" ON public.orders
FOR SELECT 
TO anon
USING (true);

-- Admin-only UPDATE policy
CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Admin-only DELETE policy
CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 4. Verify all columns exist
SELECT 
  'FINAL VERIFICATION' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
  AND column_name IN ('id', 'event_id', 'ticket_id', 'quantity', 'total_price', 'ticket_code', 'buyer_name', 'buyer_email', 'status', 'created_at', 'updated_at')
ORDER BY column_name;
