-- Test with real UUIDs from database
SELECT public.simple_insert_order(
  (SELECT id FROM public.events LIMIT 1),
  (SELECT id FROM public.tickets LIMIT 1), 
  1,
  25.00,
  'BLT-TEST123',
  'pending',
  'Test Buyer',
  'test@example.com'
);
