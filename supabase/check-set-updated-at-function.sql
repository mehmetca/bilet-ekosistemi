-- Check if set_updated_at function exists
SELECT 
  'FUNCTION CHECK' as status,
  proname as function_name,
  pronargs as parameter_count,
  prosrc as function_source
FROM pg_proc 
WHERE proname = 'set_updated_at'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
