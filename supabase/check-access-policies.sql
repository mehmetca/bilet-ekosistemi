-- Check RLS Policies for Events and Tour Events
-- This script checks if there are restrictive policies blocking access

-- 1. Check events table policies
SELECT 
  'EVENTS POLICIES' as table_name,
  policyname,
  cmd,
  roles,
  qual as using_clause,
  with_check as check_clause
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'events'
ORDER BY policyname;

-- 2. Check tour_events table policies
SELECT 
  'TOUR_EVENTS POLICIES' as table_name,
  policyname,
  cmd,
  roles,
  qual as using_clause,
  with_check as check_clause
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'tour_events'
ORDER BY policyname;

-- 3. Check if RLS is enabled
SELECT 
  'RLS STATUS' as status,
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class 
WHERE relname IN ('events', 'tour_events')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY relname;

-- 4. Check if tables exist
SELECT 
  'TABLE EXISTENCE' as status,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('events', 'tour_events')
ORDER BY table_name;
