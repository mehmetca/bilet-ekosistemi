-- Check all functions with search_path issues (corrected)
SELECT 
  'FUNCTION SEARCH_PATH ISSUES' as status,
  proname as function_name,
  pronamespace::regnamespace as schema_name,
  proconfig as config_settings,
  prosecdef as security_definer
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
  AND prosecdef = true
  AND (proconfig IS NULL OR NOT ('search_path' = ANY(proconfig)))
ORDER BY proname;
