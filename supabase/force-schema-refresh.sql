-- Force Schema Cache Refresh and Column Verification
-- This script forces Supabase to refresh the schema cache completely

-- 1. Force schema cache refresh
SELECT set_config('search_path', 'public', false);

-- 2. Check current table structure
SELECT 
  'CURRENT TABLE STRUCTURE' as status,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Force table statistics update
ANALYZE public.orders;

-- 4. Check if columns exist in pg_attribute (PostgreSQL system catalog)
SELECT 
  'SYSTEM CATALOG CHECK' as status,
  attname as column_name,
  typname as data_type,
  attnotnull as not_null
FROM pg_attribute a
JOIN pg_type t ON a.atttypid = t.oid
JOIN pg_class c ON a.attrelid = c.oid
WHERE c.relname = 'orders'
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;

-- 5. Add columns with explicit error handling
DO $$
BEGIN
  -- Add buyer_name column
  BEGIN
    ALTER TABLE public.orders ADD COLUMN buyer_name TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'buyer_name column added successfully';
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'buyer_name column already exists';
  END;

  -- Add buyer_email column
  BEGIN
    ALTER TABLE public.orders ADD COLUMN buyer_email TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'buyer_email column added successfully';
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'buyer_email column already exists';
  END;
END $$;

-- 6. Final verification
SELECT 
  'FINAL VERIFICATION' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
  AND column_name IN ('buyer_name', 'buyer_email')
ORDER BY column_name;
