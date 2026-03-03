CREATE OR REPLACE FUNCTION public.simple_insert_order(
  p_event_id TEXT,
  p_ticket_id TEXT,
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
  -- Check if event_id and ticket_id are valid UUIDs
  IF p_event_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND
     p_ticket_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    -- Valid UUIDs, try to insert with all columns
    BEGIN
      INSERT INTO public.orders (
        event_id, ticket_id, quantity, total_price, ticket_code, status, buyer_name, buyer_email
      ) VALUES (
        p_event_id::uuid, p_ticket_id::uuid, p_quantity, p_total_price, p_ticket_code, p_status, p_buyer_name, p_buyer_email
      );
      RETURN;
    EXCEPTION WHEN undefined_column THEN
      -- If buyer_name or buyer_email columns don't exist, try without them
      BEGIN
        INSERT INTO public.orders (
          event_id, ticket_id, quantity, total_price, ticket_code, status
        ) VALUES (
          p_event_id::uuid, p_ticket_id::uuid, p_quantity, p_total_price, p_ticket_code, p_status
        );
        RETURN;
      EXCEPTION WHEN undefined_column THEN
        -- If that also fails, try minimal insert
        INSERT INTO public.orders (
          event_id, ticket_id, quantity, total_price, ticket_code
        ) VALUES (
          p_event_id::uuid, p_ticket_id::uuid, p_quantity, p_total_price, p_ticket_code
        );
      END;
    END;
  ELSE
    -- Invalid UUIDs, raise error
    RAISE EXCEPTION 'Invalid UUID format for event_id or ticket_id';
  END IF;
END;
$$;
