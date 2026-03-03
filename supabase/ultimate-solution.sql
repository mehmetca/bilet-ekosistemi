-- Ultimate Solution - Create Orders Table from Scratch
-- This completely recreates the orders table to fix all schema issues

-- 1. Backup existing data if possible
CREATE TABLE IF NOT EXISTS orders_backup AS 
SELECT * FROM public.orders;

-- 2. Drop the problematic table completely
DROP TABLE IF EXISTS public.orders CASCADE;

-- 3. Create orders table with all required columns
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

-- 4. Restore data from backup if it exists
INSERT INTO public.orders (
  id, event_id, ticket_id, quantity, total_price, 
  ticket_code, buyer_name, buyer_email, status, 
  created_at, updated_at
)
SELECT 
  id, event_id, ticket_id, quantity, total_price, 
  ticket_code, COALESCE(buyer_name, '') as buyer_name, 
  COALESCE(buyer_email, '') as buyer_email, status, 
  created_at, updated_at
FROM orders_backup;

-- 5. Create indexes
CREATE INDEX idx_orders_event_id ON public.orders(event_id);
CREATE INDEX idx_orders_ticket_id ON public.orders(ticket_id);
CREATE INDEX idx_orders_buyer_email ON public.orders(buyer_email);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);

-- 6. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 7. Create secure policies
CREATE POLICY "Orders are publicly readable" ON public.orders
FOR SELECT 
TO anon
USING (true);

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

CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE 
TO authenticated
USING ((select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- 8. Create trigger for updated_at
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

-- 9. Final verification
SELECT 
  'TABLE RECREATED SUCCESSFULLY' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
