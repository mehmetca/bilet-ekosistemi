SELECT 
  'ORDERS TEST' as status,
  COUNT(*) as total_orders,
  SUM(total_price) as total_revenue
FROM public.orders;
