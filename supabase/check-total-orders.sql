SELECT 
  'TOTAL ORDERS' as status,
  COUNT(*) as total_count,
  SUM(total_price) as total_revenue
FROM public.orders;
