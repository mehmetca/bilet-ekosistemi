-- Check tickets table structure for UUID columns
SELECT 
  'TICKETS TABLE STRUCTURE' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'tickets' 
  AND table_schema = 'public'
  AND column_name = 'id'
ORDER BY ordinal_position;
