-- Test Ticket Query
-- Test the exact query that checkTicket function uses

SELECT 
  id,
  event_id, 
  quantity, 
  buyer_name, 
  checked_at,
  ticket_code
FROM public.orders 
WHERE ticket_code = 'BLT-CDAWDBTP' 
LIMIT 1;
