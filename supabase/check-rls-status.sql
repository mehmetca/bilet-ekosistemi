-- Check if RLS is disabled for orders
SELECT 
  'RLS STATUS' as status,
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'orders';
