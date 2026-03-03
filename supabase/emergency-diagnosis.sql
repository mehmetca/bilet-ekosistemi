-- Emergency Fix - Check Current Orders Table Structure
-- This script diagnoses the actual state of the orders table

-- 1. Check if orders table exists at all
SELECT 
  'TABLE EXISTS' as status,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'orders';

-- 2. Check what columns actually exist
SELECT 
  'ACTUAL COLUMNS' as status,
  column_name,
  data_type,
  is_nullable,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check pg_attribute for system catalog view
SELECT 
  'SYSTEM CATALOG' as status,
  attname as column_name,
  typname as data_type,
  attnotnull as not_null,
  attnum as position
FROM pg_attribute a
JOIN pg_type t ON a.atttypid = t.oid
JOIN pg_class c ON a.attrelid = c.oid
WHERE c.relname = 'orders'
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;

-- 4. Check if there are any orders data
SELECT 
  'DATA COUNT' as status,
  COUNT(*) as order_count
FROM public.orders;

-- 5. Check RLS status
SELECT 
  'RLS STATUS' as status,
  relrowsecurity as rls_enabled
FROM pg_class 
WHERE relname = 'orders'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
