-- Test with valid UUID format
SELECT public.simple_insert_order(
  '12345678-1234-1234-1234-123456789012',
  '12345678-1234-1234-1234-123456789012', 
  1,
  25.00,
  'BLT-TEST123',
  'pending',
  'Test Buyer',
  'test@example.com'
);
