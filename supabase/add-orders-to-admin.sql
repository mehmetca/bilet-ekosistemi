-- Add Orders Table to Admin Panel
-- This creates queries for orders management

-- 1. Check if orders table has all necessary data
SELECT 
  'ORDERS OVERVIEW' as status,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
  COUNT(CASE WHEN checked_at IS NOT NULL THEN 1 END) as checked_orders,
  COUNT(CASE WHEN checked_at IS NULL THEN 1 END) as pending_orders,
  SUM(total_price) as total_revenue
FROM public.orders;

-- 2. Get recent orders with event details
SELECT 
  'RECENT ORDERS' as status,
  o.id,
  o.ticket_code,
  o.quantity,
  o.total_price,
  o.buyer_name,
  o.buyer_email,
  o.status,
  o.checked_at,
  o.created_at,
  COALESCE(e.title, 'Tour Event') as event_title,
  COALESCE(t.name, 'Standart Bilet') as ticket_name
FROM public.orders o
LEFT JOIN public.events e ON o.event_id = e.id
LEFT JOIN public.tickets t ON o.ticket_id = t.id
ORDER BY o.created_at DESC
LIMIT 20;

-- 3. Get orders by event
SELECT 
  'ORDERS BY EVENT' as status,
  COALESCE(e.title, 'Tour Event') as event_title,
  COUNT(*) as order_count,
  SUM(o.quantity) as total_tickets,
  SUM(o.total_price) as total_revenue,
  COUNT(CASE WHEN o.checked_at IS NOT NULL THEN 1 END) as checked_tickets
FROM public.orders o
LEFT JOIN public.events e ON o.event_id = e.id
GROUP BY o.event_id, e.title
ORDER BY total_revenue DESC
LIMIT 10;
