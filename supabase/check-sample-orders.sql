SELECT 
  'SAMPLE ORDERS' as status,
  id,
  ticket_code,
  buyer_name,
  buyer_email,
  quantity,
  total_price,
  status,
  checked_at,
  created_at
FROM public.orders 
ORDER BY created_at DESC 
LIMIT 5;
