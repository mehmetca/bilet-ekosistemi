-- Test trigger functionality
UPDATE public.orders 
SET status = 'completed' 
WHERE id = (SELECT id FROM public.orders LIMIT 1);

-- Check if updated_at was updated
SELECT 
  'TRIGGER TEST RESULT' as status,
  id,
  ticket_code,
  status,
  updated_at,
  created_at
FROM public.orders 
WHERE id = (SELECT id FROM public.orders LIMIT 1);
