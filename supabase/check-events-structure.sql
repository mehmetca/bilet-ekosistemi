-- Check events and tickets table structure for UUID columns
SELECT 
  'EVENTS TABLE STRUCTURE' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'events' 
  AND table_schema = 'public'
  AND column_name = 'id'
ORDER BY ordinal_position;
