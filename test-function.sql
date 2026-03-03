-- Test if simple_insert_order function exists and works
SELECT 
  proname,
  prosrc,
  proargtypes,
  prorettype
FROM pg_proc 
WHERE proname = 'simple_insert_order';
