-- Simple RLS Performance Check (No Extensions Required)
-- This script works without pg_stat_statements extension

-- 1. Check current RLS policies and identify performance issues
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%auth.uid()%' THEN 'NEEDS OPTIMIZATION'
    WHEN qual::text LIKE '%auth.role()%' THEN 'NEEDS OPTIMIZATION'
    WHEN qual::text LIKE '%auth.email()%' THEN 'NEEDS OPTIMIZATION'
    WHEN qual::text LIKE '%current_setting(%' THEN 'NEEDS OPTIMIZATION'
    ELSE 'OPTIMIZED'
  END as qual_status,
  CASE 
    WHEN with_check::text LIKE '%auth.uid()%' THEN 'NEEDS OPTIMIZATION'
    WHEN with_check::text LIKE '%auth.role()%' THEN 'NEEDS OPTIMIZATION'
    WHEN with_check::text LIKE '%auth.email()%' THEN 'NEEDS OPTIMIZATION'
    WHEN with_check::text LIKE '%current_setting(%' THEN 'NEEDS OPTIMIZATION'
    ELSE 'OPTIMIZED'
  END as with_check_status
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. Check which tables have RLS enabled
SELECT 
  t.tablename as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_size_pretty(pg_total_relation_size(t.tablename)) as table_size
FROM pg_tables t
JOIN pg_class c ON t.tablename = c.relname
WHERE t.schemaname = 'public'
  AND c.relrowsecurity = true
ORDER BY pg_total_relation_size(t.tablename) DESC;

-- 3. Count policies that need optimization
SELECT 
  'Performance Issues Found' as status,
  count(*) as count,
  'Total Policies' as total,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') as total_policies
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    qual::text LIKE '%auth.%' 
    OR qual::text LIKE '%current_setting%'
    OR with_check::text LIKE '%auth.%' 
    OR with_check::text LIKE '%current_setting%'
  );
