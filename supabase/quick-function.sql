-- Quick Function Creation
-- This immediately creates the missing function

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
  -- Simple insert with basic columns
  INSERT INTO public.orders (
    event_id, ticket_id, quantity, total_price, 
    ticket_code, status
  ) VALUES (
    p_event_id, p_ticket_id, p_quantity, p_total_price,
    p_ticket_code, p_status
  ) RETURNING id INTO order_id;
  
  RETURN order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.simple_insert_order TO authenticated;

-- Verify
SELECT 'FUNCTION READY' as status;
