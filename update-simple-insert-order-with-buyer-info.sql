-- Update simple_insert_order function to include buyer information
-- This will fix the buyer name and email issues

DROP FUNCTION IF EXISTS public.simple_insert_order;

CREATE OR REPLACE FUNCTION public.simple_insert_order(
  p_event_id UUID,
  p_ticket_id TEXT,
  p_quantity INTEGER,
  p_total_price NUMERIC,
  p_ticket_code TEXT,
  p_status TEXT DEFAULT 'pending',
  p_buyer_name TEXT DEFAULT NULL,
  p_buyer_email TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  ticket_id TEXT,
  quantity INTEGER,
  total_price NUMERIC,
  ticket_code TEXT,
  status TEXT,
  buyer_name TEXT,
  buyer_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  checked_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the order with buyer information
  RETURN QUERY INSERT INTO public.orders (
    event_id,
    ticket_id,
    quantity,
    total_price,
    ticket_code,
    status,
    buyer_name,
    buyer_email,
    created_at,
    checked_at
  ) VALUES (
    p_event_id,
    p_ticket_id,
    p_quantity,
    p_total_price,
    p_ticket_code,
    p_status,
    p_buyer_name,
    p_buyer_email,
    NOW(),
    NULL
  )
  RETURNING 
    id,
    event_id,
    ticket_id,
    quantity,
    total_price,
    ticket_code,
    status,
    buyer_name,
    buyer_email,
    created_at,
    checked_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.simple_insert_order TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.simple_insert_order IS 'Secure function to insert orders with buyer information and fixed search_path';
