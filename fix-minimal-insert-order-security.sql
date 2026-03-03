-- Fix security issue with minimal_insert_order function
-- Add search_path parameter to prevent mutable search_path

CREATE OR REPLACE FUNCTION public.minimal_insert_order(
    p_ticket_code TEXT,
    p_ticket_id TEXT,
    p_quantity INTEGER,
    p_total_price DECIMAL,
    p_buyer_name TEXT DEFAULT 'Bilet Alıcı',
    p_buyer_email TEXT DEFAULT 'bilinmiyor@example.com'
)
RETURNS TABLE (
    id UUID,
    ticket_code TEXT,
    ticket_id TEXT,
    quantity INTEGER,
    total_price DECIMAL,
    buyer_name TEXT,
    buyer_email TEXT,
    created_at TIMESTAMPTZ,
    checked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.orders (
        ticket_code,
        ticket_id,
        quantity,
        total_price,
        buyer_name,
        buyer_email,
        created_at
    ) VALUES (
        p_ticket_code,
        p_ticket_id,
        p_quantity,
        p_total_price,
        p_buyer_name,
        p_buyer_email,
        NOW()
    )
    RETURNING 
        id,
        ticket_code,
        ticket_id,
        quantity,
        total_price,
        buyer_name,
        buyer_email,
        created_at,
        checked_at;
END;
$$;
