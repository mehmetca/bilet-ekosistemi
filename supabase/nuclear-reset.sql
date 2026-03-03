-- Complete Reset - Drop and Recreate Everything
-- This is the nuclear option - complete reset

-- 1. Drop everything related to orders
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.orders_backup CASCADE;
DROP FUNCTION IF EXISTS public.safe_insert_order CASCADE;
DROP FUNCTION IF EXISTS public.minimal_insert_order CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at CASCADE;
DROP VIEW IF EXISTS public.orders_view CASCADE;
DROP VIEW IF EXISTS public.orders_simple_view CASCADE;

-- 2. Remove all policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'orders' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', r.policyname);
  END LOOP;
END $$;

-- 3. Create fresh orders table
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  ticket_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  ticket_code TEXT NOT NULL UNIQUE,
  buyer_name TEXT NOT NULL DEFAULT '',
  buyer_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes
CREATE INDEX idx_orders_event_id ON public.orders(event_id);
CREATE INDEX idx_orders_ticket_id ON public.orders(ticket_id);
CREATE INDEX idx_orders_buyer_email ON public.orders(buyer_email);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);

-- 5. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 6. Create simple policies
CREATE POLICY "Orders are publicly readable" ON public.orders
FOR SELECT 
TO anon
USING (true);

CREATE POLICY "Authenticated users can insert orders" ON public.orders
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 7. Create trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 8. Final verification
SELECT 
  'COMPLETE RESET DONE' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
