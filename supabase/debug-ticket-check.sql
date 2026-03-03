-- Fix Ticket Verification Query
-- This ensures the checkTicket function can find orders properly

-- 1. Check current orders structure
SELECT 
  'CURRENT STRUCTURE' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if there are any orders
SELECT 
  'ORDERS DATA' as status,
  COUNT(*) as total_orders,
  COUNT(DISTINCT ticket_code) as unique_tickets
FROM public.orders;

-- 3. Check recent orders with all fields
SELECT 
  'RECENT ORDERS' as status,
  id,
  ticket_code,
  event_id,
  ticket_id,
  quantity,
  total_price,
  buyer_name,
  buyer_email,
  status,
  checked_at,
  created_at
FROM public.orders 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Test query that checkTicket function uses
SELECT 
  'TEST QUERY' as status,
  'This is the query used by checkTicket function' as description;

-- The actual query from checkTicket function:
-- SELECT id, event_id, quantity, buyer_name, checked_at FROM public.orders WHERE ticket_code = [CODE] LIMIT 1

-- 5. Check if checked_at column exists
SELECT 
  'CHECKED_AT COLUMN' as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orders' 
        AND column_name = 'checked_at' 
        AND table_schema = 'public'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as column_status;
