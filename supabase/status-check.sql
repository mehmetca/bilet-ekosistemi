-- Quick Status Check - Before and After Comparison
-- Run this to see exactly which policies need fixing

-- Current status with performance issues
SELECT 
  'CURRENT STATUS' as status,
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
  AND (
    qual::text LIKE '%auth.%' 
    OR qual::text LIKE '%current_setting%'
    OR with_check::text LIKE '%auth.%' 
    OR with_check::text LIKE '%current_setting%'
  )
ORDER BY tablename, policyname;
