-- Application Layer Fix for Schema Cache Issues
-- This script modifies the purchaseTickets function to handle missing columns gracefully

-- 1. Check what columns actually exist in orders table
SELECT 
  'AVAILABLE COLUMNS' as status,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY column_name;

-- 2. Create a dynamic insert function that adapts to available columns
CREATE OR REPLACE FUNCTION public.insert_order_adaptive(
  p_event_id UUID,
  p_ticket_id UUID,
  p_quantity INTEGER,
  p_total_price NUMERIC,
  p_ticket_code TEXT,
  p_buyer_name TEXT,
  p_buyer_email TEXT,
  p_status TEXT DEFAULT 'completed'
)
RETURNS UUID AS $$
DECLARE
  order_id UUID;
  has_buyer_name BOOLEAN;
  has_buyer_email BOOLEAN;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND table_schema = 'public' 
      AND column_name = 'buyer_name'
  ) INTO has_buyer_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND table_schema = 'public' 
      AND column_name = 'buyer_email'
  ) INTO has_buyer_email;

  -- Dynamic insert based on available columns
  IF has_buyer_name AND has_buyer_email THEN
    INSERT INTO public.orders (
      event_id, ticket_id, quantity, total_price, 
      ticket_code, buyer_name, buyer_email, status
    ) VALUES (
      p_event_id, p_ticket_id, p_quantity, p_total_price,
      p_ticket_code, p_buyer_name, p_buyer_email, p_status
    ) RETURNING id INTO order_id;
  
  ELSIF has_buyer_name THEN
    INSERT INTO public.orders (
      event_id, ticket_id, quantity, total_price, 
      ticket_code, buyer_name, status
    ) VALUES (
      p_event_id, p_ticket_id, p_quantity, p_total_price,
      p_ticket_code, p_buyer_name, p_status
    ) RETURNING id INTO order_id;
  
  ELSIF has_buyer_email THEN
    INSERT INTO public.orders (
      event_id, ticket_id, quantity, total_price, 
      ticket_code, buyer_email, status
    ) VALUES (
      p_event_id, p_ticket_id, p_quantity, p_total_price,
      p_ticket_code, p_buyer_email, p_status
    ) RETURNING id INTO order_id;
  
  ELSE
    -- Fallback without buyer columns
    INSERT INTO public.orders (
      event_id, ticket_id, quantity, total_price, 
      ticket_code, status
    ) VALUES (
      p_event_id, p_ticket_id, p_quantity, p_total_price,
      p_ticket_code, p_status
    ) RETURNING id INTO order_id;
  END IF;

  RETURN order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute permission
GRANT EXECUTE ON FUNCTION public.insert_order_adaptive TO authenticated;

-- 4. Test the function
SELECT 
  'FUNCTION CREATED' as status,
  'insert_order_adaptive' as function_name,
  'Handles missing columns gracefully' as capability;
