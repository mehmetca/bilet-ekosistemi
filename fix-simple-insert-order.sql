-- Fix simple_insert_order function security issue
-- Add search_path parameter to make function secure

DROP FUNCTION IF EXISTS public.simple_insert_order;

CREATE OR REPLACE FUNCTION public.simple_insert_order(
  p_event_id UUID,
  p_ticket_id TEXT,
  p_quantity INTEGER,
  p_total_price NUMERIC,
  p_ticket_code TEXT,
  p_status TEXT DEFAULT 'pending'
)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  ticket_id TEXT,
  quantity INTEGER,
  total_price NUMERIC,
  ticket_code TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  checked_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the order with explicit column names
  RETURN QUERY INSERT INTO public.orders (
    event_id,
    ticket_id,
    quantity,
    total_price,
    ticket_code,
    status,
    created_at,
    checked_at
  ) VALUES (
    p_event_id,
    p_ticket_id,
    p_quantity,
    p_total_price,
    p_ticket_code,
    p_status,
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
    created_at,
    checked_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.simple_insert_order TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.simple_insert_order IS 'Secure function to insert orders with fixed search_path';
