-- Check Orders Data for Admin Panel
-- This verifies orders exist and can be displayed

-- 1. Check total orders count
SELECT 
  'TOTAL ORDERS' as status,
  COUNT(*) as total_count,
  SUM(total_price) as total_revenue
FROM public.orders;

-- 2. Check recent orders (last 24 hours)
SELECT 
  'RECENT ORDERS' as status,
  COUNT(*) as recent_count,
  SUM(total_price) as recent_revenue
FROM public.orders 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- 3. Get sample orders for display
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
