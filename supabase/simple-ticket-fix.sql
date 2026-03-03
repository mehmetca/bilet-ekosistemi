-- Fix Ticket Verification - Simple Solution
-- This fixes the checkTicket function issue

-- 1. Update existing orders to have proper buyer_name
UPDATE public.orders 
SET buyer_name = COALESCE(buyer_name, 'Bilet Alıcı')
WHERE buyer_name IS NULL OR buyer_name = '';

-- 2. Verify the update
SELECT 
  'ORDERS UPDATED' as status,
  COUNT(*) as updated_count
FROM public.orders 
WHERE buyer_name = 'Bilet Alıcı';

-- 3. Test the exact query that checkTicket uses
SELECT 
  'TEST QUERY 1' as status,
  id,
  event_id, 
  quantity, 
  buyer_name, 
  checked_at,
  ticket_code
FROM public.orders 
WHERE ticket_code = 'BLT-CDAWDBTP' 
LIMIT 1;

-- 4. Test with the other ticket
SELECT 
  'TEST QUERY 2' as status,
  id,
  event_id, 
  quantity, 
  buyer_name, 
  checked_at,
  ticket_code
FROM public.orders 
WHERE ticket_code = 'BLT-ATSENPEE' 
LIMIT 1;

-- 5. Show all orders for verification
SELECT 
  'ALL ORDERS' as status,
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
ORDER BY created_at DESC;
