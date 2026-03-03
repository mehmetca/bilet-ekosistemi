-- Check if trigger exists for orders table
SELECT 
  'TRIGGER CHECK' as status,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgfoid::regproc as function_name,
  tgenabled as trigger_enabled
FROM pg_trigger 
WHERE tgname = 'orders_updated_at'
  AND tgrelid = 'public.orders'::regclass;
