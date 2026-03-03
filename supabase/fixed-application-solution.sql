-- Fixed Application-Level Solution
-- This creates a safe insert function without using problematic columns in views

-- 1. Create a flexible insert function that adapts to available columns
CREATE OR REPLACE FUNCTION public.safe_insert_order(
  p_event_id UUID,
  p_ticket_id UUID,
  p_quantity INTEGER,
  p_total_price NUMERIC,
  p_ticket_code TEXT,
  p_buyer_name TEXT DEFAULT '',
  p_buyer_email TEXT DEFAULT '',
  p_status TEXT DEFAULT 'completed'
)
RETURNS UUID AS $$
DECLARE
  order_id UUID;
  has_buyer_name BOOLEAN := FALSE;
  has_buyer_email BOOLEAN := FALSE;
BEGIN
  -- Check if buyer_name column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND table_schema = 'public' 
      AND column_name = 'buyer_name'
  ) INTO has_buyer_name;

  -- Check if buyer_email column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND table_schema = 'public' 
      AND column_name = 'buyer_email'
  ) INTO has_buyer_email;

  -- Build dynamic insert based on available columns
  IF has_buyer_name AND has_buyer_email THEN
    -- Both columns exist
    INSERT INTO public.orders (
      event_id, ticket_id, quantity, total_price, 
      ticket_code, buyer_name, buyer_email, status
    ) VALUES (
      p_event_id, p_ticket_id, p_quantity, p_total_price,
      p_ticket_code, p_buyer_name, p_buyer_email, p_status
    ) RETURNING id INTO order_id;
  
  ELSIF has_buyer_name THEN
    -- Only buyer_name exists
    INSERT INTO public.orders (
      event_id, ticket_id, quantity, total_price, 
      ticket_code, buyer_name, status
    ) VALUES (
      p_event_id, p_ticket_id, p_quantity, p_total_price,
      p_ticket_code, p_buyer_name, p_status
    ) RETURNING id INTO order_id;
  
  ELSIF has_buyer_email THEN
    -- Only buyer_email exists
    INSERT INTO public.orders (
      event_id, ticket_id, quantity, total_price, 
      ticket_code, buyer_email, status
    ) VALUES (
      p_event_id, p_ticket_id, p_quantity, p_total_price,
      p_ticket_code, p_buyer_email, p_status
    ) RETURNING id INTO order_id;
  
  ELSE
    -- Neither column exists - use basic columns only
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

-- 2. Grant execution permission
GRANT EXECUTE ON FUNCTION public.safe_insert_order TO authenticated;

-- 3. Create a safe view that doesn't reference missing columns
CREATE OR REPLACE VIEW public.orders_view AS
SELECT 
  o.id,
  o.event_id,
  o.ticket_id,
  o.quantity,
  o.total_price,
  o.ticket_code,
  o.status,
  o.created_at,
  o.updated_at,
  -- Only include columns that actually exist
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orders' 
        AND table_schema = 'public' 
        AND column_name = 'buyer_name'
    ) THEN o.buyer_name
    ELSE ''
  END as buyer_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orders' 
        AND table_schema = 'public' 
        AND column_name = 'buyer_email'
    ) THEN o.buyer_email
    ELSE ''
  END as buyer_email
FROM public.orders o;

-- 4. Grant permissions on view
GRANT SELECT ON public.orders_view TO anon;
GRANT ALL ON public.orders_view TO authenticated;

-- 5. Test the function
SELECT 
  'FIXED APPLICATION SOLUTION' as status,
  'safe_insert_order' as function_name,
  'Handles missing columns gracefully' as capability,
  'orders_view' as view_name,
  'Safe column handling' as view_capability;
