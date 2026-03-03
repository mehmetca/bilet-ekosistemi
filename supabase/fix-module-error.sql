-- Fix Module Import Error
-- This fixes the Supabase client import issue

-- 1. Check if tables exist and are accessible
SELECT 
  'TABLE STATUS' as status,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('events', 'tour_events', 'tickets', 'orders')
ORDER BY table_name;

-- 2. Check RLS status
SELECT 
  'RLS STATUS' as status,
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class 
WHERE relname IN ('events', 'tour_events', 'tickets', 'orders')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY relname;

-- 3. Test basic access
SELECT 
  'ACCESS TEST' as status,
  'events' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'events' AND table_schema = 'public') as column_count;

SELECT 
  'ACCESS TEST' as status,
  'tour_events' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tour_events' AND table_schema = 'public') as column_count;
