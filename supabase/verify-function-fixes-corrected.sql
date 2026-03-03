-- Verify function fixes (corrected version)
SELECT 
  'FUNCTION VERIFICATION' as status,
  proname as function_name,
  pronamespace::regnamespace as schema_name,
  proconfig as config_settings,
  prosecdef as security_definer
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
  AND prosecdef = true
  AND proname IN ('simple_insert_order', 'set_updated_at')
ORDER BY proname;
