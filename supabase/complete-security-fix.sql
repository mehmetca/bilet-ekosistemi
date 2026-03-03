-- Complete Security Audit and Fix
-- This script addresses both RLS security issues and password protection

-- 1. Fix RLS Security Issues
-- Remove overly permissive policies

-- Fix orders table - remove "Users can insert own orders" that bypasses RLS
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;

-- Create proper user order insertion policy
CREATE POLICY "Users can insert own orders" ON public.orders
FOR INSERT 
WITH CHECK (
  -- Users can only insert orders with their own email
  buyer_email = (select auth.email())
  OR
  -- Admins can insert any order
  (select auth.uid()) IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
);

-- Check for other overly permissive policies that need fixing
SELECT 
  'SECURITY AUDIT' as audit_type,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL AND qual::text = 'true' THEN 'OVERLY PERMISSIVE SELECT'
    WHEN with_check IS NOT NULL AND with_check::text = 'true' THEN 'OVERLY PERMISSIVE INSERT/UPDATE'
    ELSE 'SECURE'
  END as security_status,
  CASE 
    WHEN qual IS NOT NULL AND qual::text = 'true' THEN 'NEEDS IMMEDIATE ATTENTION'
    WHEN with_check IS NOT NULL AND with_check::text = 'true' THEN 'NEEDS IMMEDIATE ATTENTION'
    ELSE 'OK'
  END as action_required
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    (qual IS NOT NULL AND qual::text = 'true')
    OR (with_check IS NOT NULL AND with_check::text = 'true')
  )
ORDER BY 
  CASE 
    WHEN qual IS NOT NULL AND qual::text = 'true' THEN 1
    WHEN with_check IS NOT NULL AND with_check::text = 'true' THEN 1
    ELSE 2
  END,
  tablename, 
  policyname;

-- 2. Password Protection Configuration
-- Note: Auth settings typically require Dashboard access

-- Check current auth security settings
SELECT 
  'AUTH SECURITY AUDIT' as audit_type,
  name as setting_name,
  value as current_value,
  CASE 
    WHEN name = 'password_protection_enabled' AND value = 'false' THEN 'DISABLED - SECURITY RISK'
    WHEN name = 'password_protection_enabled' AND value = 'true' THEN 'ENABLED - SECURE'
    WHEN name = 'password_protection_provider' AND value = 'haveibeenpwned' THEN 'OPTIMAL'
    WHEN name = 'password_protection_provider' AND value != 'haveibeenpwned' THEN 'SUBOPTIMAL'
    ELSE 'UNKNOWN'
  END as security_status
FROM auth.config 
WHERE name IN (
  'password_protection_enabled',
  'password_protection_provider',
  'external_password_providers_enabled'
);

-- 3. Security Recommendations
SELECT 
  'RECOMMENDATIONS' as category,
  'Enable Leaked Password Protection' as recommendation,
  'Configure in Supabase Dashboard > Authentication > Settings' as action,
  'HIGH PRIORITY' as priority
UNION ALL
SELECT 
  'RECOMMENDATIONS' as category,
  'Review All RLS Policies' as recommendation,
  'Ensure no overly permissive WITH CHECK (true) clauses' as action,
  'HIGH PRIORITY' as priority
UNION ALL
SELECT 
  'RECOMMENDATIONS' as category,
  'Regular Security Audits' as recommendation,
  'Run this script monthly to check for security issues' as action,
  'MEDIUM PRIORITY' as priority;

-- 4. Verify orders table fix
SELECT 
  'VERIFICATION' as category,
  tablename,
  policyname,
  cmd,
  with_check as policy_logic
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'orders'
  AND policyname = 'Users can insert own orders';
