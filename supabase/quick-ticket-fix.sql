-- Quick Fix for Ticket Verification
-- This adds missing checked_at column if needed and fixes the query

-- 1. Add checked_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
      AND column_name = 'checked_at' 
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN checked_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'checked_at column added to orders table';
  END IF;
END $$;

-- 2. Verify the column was added
SELECT 
  'COLUMN CHECK' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name = 'checked_at'
  AND table_schema = 'public';

-- 3. Test the exact query that checkTicket function uses
SELECT 
  'QUERY TEST' as status,
  'Testing the exact query from checkTicket function' as description;

-- This simulates: SELECT id, event_id, quantity, buyer_name, checked_at FROM public.orders WHERE ticket_code = 'TEST-CODE' LIMIT 1
SELECT 
  id,
  event_id, 
  quantity, 
  buyer_name, 
  checked_at 
FROM public.orders 
WHERE ticket_code = 'TEST-CODE' 
LIMIT 1;

-- 4. Show all recent orders for debugging
SELECT 
  'ALL RECENT ORDERS' as status,
  id,
  ticket_code,
  event_id,
  ticket_id,
  quantity,
  buyer_name,
  buyer_email,
  status,
  checked_at,
  created_at
FROM public.orders 
ORDER BY created_at DESC 
LIMIT 3;
