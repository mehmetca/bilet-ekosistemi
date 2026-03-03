-- Verify function exists and works
SELECT 
  'FUNCTION VERIFICATION' as status,
  proname as function_name,
  pronamespace::regnamespace as schema_name,
  proconfig as config_settings,
  prosecdef as security_definer
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'simple_insert_order'
ORDER BY proname;
