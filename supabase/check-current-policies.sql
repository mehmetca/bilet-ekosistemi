-- Check current RLS policies
SELECT 
  'CURRENT POLICIES' as status,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'orders';
