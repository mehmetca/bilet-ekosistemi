DROP FUNCTION IF EXISTS public.simple_insert_order;

CREATE FUNCTION public.simple_insert_order(
  p_event_id UUID,
  p_ticket_id UUID,
  p_quantity INTEGER,
  p_total_price DECIMAL,
  p_ticket_code TEXT,
  p_status TEXT DEFAULT 'pending',
  p_buyer_name TEXT DEFAULT NULL,
  p_buyer_email TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.orders (
    event_id, ticket_id, quantity, total_price, ticket_code, status, buyer_name, buyer_email
  ) VALUES (
    p_event_id, p_ticket_id, p_quantity, p_total_price, p_ticket_code, p_status, 
    p_buyer_name,
    p_buyer_email
  );
END;
$$;
