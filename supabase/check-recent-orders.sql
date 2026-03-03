SELECT 
  'RECENT ORDERS' as status,
  COUNT(*) as recent_count,
  SUM(total_price) as recent_revenue
FROM public.orders 
WHERE created_at >= NOW() - INTERVAL '24 hours';
