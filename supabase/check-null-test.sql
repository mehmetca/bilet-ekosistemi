-- Check the test order with NULL handling
SELECT 
  'NULL HANDLING TEST' as status,
  id,
  ticket_code,
  buyer_name,
  buyer_email,
  quantity,
  total_price,
  status,
  created_at
FROM public.orders 
WHERE ticket_code = 'BLT-TEST456'
ORDER BY created_at DESC
LIMIT 1;
