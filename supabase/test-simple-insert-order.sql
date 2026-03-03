-- Test simple_insert_order function
SELECT public.simple_insert_order(
  'test-event-id',
  'test-ticket-id', 
  1,
  25.00,
  'BLT-TEST123',
  'pending',
  'Test Buyer',
  'test@example.com'
);
