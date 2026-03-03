-- Check if test order was created
SELECT 
  'TEST ORDER CHECK' as status,
  id,
  ticket_code,
  buyer_name,
  buyer_email,
  quantity,
  total_price,
  status,
  created_at
FROM public.orders 
WHERE ticket_code = 'BLT-TEST123'
ORDER BY created_at DESC
LIMIT 1;
