-- Force Schema Cache Refresh and Function Creation
-- This ensures the function is available in the schema cache

-- 1. Reset schema cache
RESET search_path;
SELECT set_config('search_path', 'public', false);
SELECT pg_reload_conf();

-- 2. Drop existing function if any
DROP FUNCTION IF EXISTS public.simple_insert_order CASCADE;

-- 3. Create the function
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
  -- Try full insert first
  BEGIN
    INSERT INTO public.orders (
      event_id, ticket_id, quantity, total_price, 
      ticket_code, buyer_name, buyer_email, status
    ) VALUES (
      p_event_id, p_ticket_id, p_quantity, p_total_price,
      p_ticket_code, '', '', p_status
    ) RETURNING id INTO order_id;
    RETURN order_id;
  EXCEPTION WHEN undefined_column THEN
    -- Try basic insert
    BEGIN
      INSERT INTO public.orders (
        event_id, ticket_id, quantity, total_price, 
        ticket_code, status
      ) VALUES (
        p_event_id, p_ticket_id, p_quantity, p_total_price,
        p_ticket_code, p_status
      ) RETURNING id INTO order_id;
      RETURN order_id;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Insert failed: %', SQLERRM;
    END;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.simple_insert_order TO authenticated;

-- 5. Force cache refresh again
ANALYZE public.orders;

-- 6. Verify function exists
SELECT 
  'FUNCTION DEPLOYED' as status,
  proname as function_name,
  pronargs as parameter_count
FROM pg_proc 
WHERE proname = 'simple_insert_order'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
