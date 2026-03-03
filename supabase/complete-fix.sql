-- Emergency Table Structure Fix
-- This creates the orders table with all required columns

-- 1. Drop the broken table completely
DROP TABLE IF EXISTS public.orders CASCADE;

-- 2. Create orders table with ALL required columns
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

-- 3. Create indexes
CREATE INDEX idx_orders_event_id ON public.orders(event_id);
CREATE INDEX idx_orders_ticket_id ON public.orders(ticket_id);
CREATE INDEX idx_orders_buyer_email ON public.orders(buyer_email);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);

-- 4. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 5. Create simple policies
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

-- 6. Create trigger for updated_at
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

-- 7. Create the insert function
CREATE OR REPLACE FUNCTION public.simple_insert_order(
  p_event_id UUID,
  p_ticket_id UUID,
  p_quantity INTEGER,
  p_total_price NUMERIC,
  p_ticket_code TEXT,
  p_status TEXT DEFAULT 'completed'
)
RETURNS UUID AS $$
DECLARE
  order_id UUID;
BEGIN
  INSERT INTO public.orders (
    event_id, ticket_id, quantity, total_price, 
    ticket_code, buyer_name, buyer_email, status
  ) VALUES (
    p_event_id, p_ticket_id, p_quantity, p_total_price,
    p_ticket_code, '', '', p_status
  ) RETURNING id INTO order_id;
  
  RETURN order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant permissions
GRANT EXECUTE ON FUNCTION public.simple_insert_order TO authenticated;

-- 9. Final verification
SELECT 
  'COMPLETE FIX DEPLOYED' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
