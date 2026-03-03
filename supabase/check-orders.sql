-- Siparişleri kontrol et
SELECT 
  o.id,
  o.ticket_code,
  o.buyer_name,
  o.buyer_email,
  o.quantity,
  o.total_price,
  o.created_at,
  o.checked_at,
  e.title as event_title,
  e.date as event_date,
  e.time as event_time,
  t.name as ticket_name,
  t.type as ticket_type
FROM public.orders o
LEFT JOIN public.events e ON o.event_id = e.id
LEFT JOIN public.tickets t ON o.ticket_id = t.id
ORDER BY o.created_at DESC;

-- Tablo sayılarını kontrol et
SELECT 
  'orders' as table_name, COUNT(*) as count FROM public.orders
UNION ALL
SELECT 
  'events' as table_name, COUNT(*) as count FROM public.events
UNION ALL
SELECT 
  'tickets' as table_name, COUNT(*) as count FROM public.tickets;
