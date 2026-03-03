-- Disable RLS for Orders Table - Quick Fix
-- This temporarily disables RLS to allow admin access

ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
