-- Test orders access with current policies
SELECT 
  'ORDERS ACCESS TEST' as status,
  COUNT(*) as accessible_orders,
  SUM(total_price) as accessible_revenue
FROM public.orders;
