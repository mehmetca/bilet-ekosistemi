SELECT 
  'UPDATE RESULT' as status,
  COUNT(*) as updated_orders
FROM public.orders 
WHERE buyer_name = 'Bilet Alıcı';
