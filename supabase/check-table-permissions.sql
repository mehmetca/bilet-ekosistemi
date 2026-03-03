-- Check table permissions
SELECT 
  'TABLE PERMISSIONS' as status,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'orders';
