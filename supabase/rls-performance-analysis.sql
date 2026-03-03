-- RLS Performance Analysis and Monitoring Script
-- This script helps identify and monitor RLS performance issues

-- 1. Identify tables with RLS enabled
SELECT 
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_size_pretty(pg_total_relation_size(c.relname)) as table_size,
  (SELECT count(*) FROM pg_policies WHERE tablename = c.relname) as policy_count
FROM pg_class c
JOIN pg_tables t ON c.relname = t.tablename
WHERE c.relrowsecurity = true
  AND t.schemaname = 'public'
ORDER BY pg_total_relation_size(c.relname) DESC;

-- 2. Find policies with potential performance issues
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%auth.uid()%' THEN 'auth.uid() - NEEDS OPTIMIZATION'
    WHEN qual::text LIKE '%auth.role()%' THEN 'auth.role() - NEEDS OPTIMIZATION'
    WHEN qual::text LIKE '%auth.email()%' THEN 'auth.email() - NEEDS OPTIMIZATION'
    WHEN qual::text LIKE '%current_setting(%' THEN 'current_setting() - NEEDS OPTIMIZATION'
    ELSE 'OK'
  END as qual_issue,
  CASE 
    WHEN with_check::text LIKE '%auth.uid()%' THEN 'auth.uid() - NEEDS OPTIMIZATION'
    WHEN with_check::text LIKE '%auth.role()%' THEN 'auth.role() - NEEDS OPTIMIZATION'
    WHEN with_check::text LIKE '%auth.email()%' THEN 'auth.email() - NEEDS OPTIMIZATION'
    WHEN with_check::text LIKE '%current_setting(%' THEN 'current_setting() - NEEDS OPTIMIZATION'
    ELSE 'OK'
  END as with_check_issue
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    qual::text LIKE '%auth.%' 
    OR qual::text LIKE '%current_setting%'
    OR with_check::text LIKE '%auth.%' 
    OR with_check::text LIKE '%current_setting%'
  )
ORDER BY tablename, policyname;

-- 3. Monitor query performance on RLS-protected tables
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_tup_hot_upd
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND relname IN (
    SELECT DISTINCT tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  )
ORDER BY seq_scan DESC;

-- 4. Check for slow queries related to RLS
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE query LIKE '%public.%'
  AND (
    query LIKE '%artists%'
    OR query LIKE '%events%'
    OR query LIKE '%tickets%'
    OR query LIKE '%orders%'
  )
ORDER BY mean_time DESC
LIMIT 10;

-- 5. Performance impact assessment
SELECT 
  'RLS Performance Impact Assessment' as assessment_type,
  'Tables with RLS' as metric,
  count(*) as value,
  'Total tables' as total,
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') as total_tables
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY assessment_type, metric

UNION ALL

SELECT 
  'RLS Performance Impact Assessment' as assessment_type,
  'Policies with auth functions' as metric,
  count(*) as value,
  'Total policies' as total,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') as total_policies
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    qual::text LIKE '%auth.%' 
    OR with_check::text LIKE '%auth.%'
  )
GROUP BY assessment_type, metric;

-- 6. Recommendations for optimization
SELECT 
  'RECOMMENDATION' as type,
  'Replace auth.uid() with (select auth.uid())' as recommendation,
  'This prevents row-by-row re-evaluation' as explanation
UNION ALL
SELECT 
  'RECOMMENDATION' as type,
  'Replace auth.role() with (select auth.role())' as recommendation,
  'This prevents row-by-row re-evaluation' as explanation
UNION ALL
SELECT 
  'RECOMMENDATION' as type,
  'Replace current_setting() with (select current_setting())' as recommendation,
  'This prevents row-by-row re-evaluation' as explanation
UNION ALL
SELECT 
  'RECOMMENDATION' as type,
  'Consider disabling RLS for read-heavy tables' as recommendation,
  'Use application-level checks for reads, RLS for writes' as explanation;
