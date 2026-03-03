-- Check Orders Table for Admin Panel
-- This verifies orders data exists and can be fetched

-- 1. Check if orders table has data
SELECT 
  'ORDERS COUNT' as status,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
  COUNT(CASE WHEN checked_at IS NOT NULL THEN 1 END) as checked_orders,
  SUM(total_price) as total_revenue
FROM public.orders;

-- 2. Get recent orders for admin panel
SELECT 
  'RECENT ORDERS' as status,
  id,
  ticket_code,
  quantity,
  total_price,
  buyer_name,
  buyer_email,
  status,
  checked_at,
  created_at
FROM public.orders 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check if there are any orders in the last 24 hours
SELECT 
  'LAST 24H' as status,
  COUNT(*) as recent_orders,
  SUM(total_price) as recent_revenue
FROM public.orders 
WHERE created_at >= NOW() - INTERVAL '24 hours';
