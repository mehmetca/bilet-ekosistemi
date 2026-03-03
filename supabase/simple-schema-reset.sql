-- Simple Schema Cache Reset
-- This script resets the schema cache completely

-- 1. Reset search path
RESET search_path;
SELECT set_config('search_path', 'public', false);

-- 2. Force PostgreSQL to reload schema information
SELECT pg_reload_conf();

-- 3. Check orders table structure
SELECT 
  'SCHEMA CACHE RESET' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Add missing columns with explicit error handling
DO $$
BEGIN
  -- Add buyer_name if missing
  PERFORM 1 FROM information_schema.columns 
  WHERE table_name = 'orders' 
    AND table_schema = 'public' 
    AND column_name = 'buyer_name';
  
  IF NOT FOUND THEN
    ALTER TABLE public.orders ADD COLUMN buyer_name TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added buyer_name column';
  END IF;

  -- Add buyer_email if missing
  PERFORM 1 FROM information_schema.columns 
  WHERE table_name = 'orders' 
    AND table_schema = 'public' 
    AND column_name = 'buyer_email';
  
  IF NOT FOUND THEN
    ALTER TABLE public.orders ADD COLUMN buyer_email TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added buyer_email column';
  END IF;
END $$;

-- 5. Force table re-analysis
ANALYZE public.orders;

-- 6. Final verification
SELECT 
  'FINAL CHECK' as status,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
  AND column_name IN ('buyer_name', 'buyer_email')
ORDER BY column_name;
