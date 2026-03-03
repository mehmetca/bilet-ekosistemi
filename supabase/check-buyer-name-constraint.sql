-- Check buyer_name constraint in orders table
SELECT 
  'BUYER_NAME CONSTRAINT' as status,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
  AND column_name = 'buyer_name';
