-- Fix RLS policies for orders table
-- Remove overly permissive policies and add proper security

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Enable all access for ALL" ON public.orders;

-- Create proper RLS policies for orders table

-- 1. Users can see their own orders
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT USING (auth.uid()::text = buyer_email::text OR buyer_email = 'bilinmiyor@example.com');

-- 2. Users can insert their own orders
CREATE POLICY "Users can insert their own orders" ON public.orders
    FOR INSERT WITH CHECK (auth.uid()::text = buyer_email::text OR buyer_email = 'bilinmiyor@example.com');

-- 3. Users can update their own orders (limited fields)
CREATE POLICY "Users can update their own orders" ON public.orders
    FOR UPDATE USING (auth.uid()::text = buyer_email::text OR buyer_email = 'bilinmiyor@example.com')
    WITH CHECK (auth.uid()::text = buyer_email::text OR buyer_email = 'bilinmiyor@example.com');

-- 4. Admins can do everything
CREATE POLICY "Admins can manage all orders" ON public.orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 5. Service role can do everything (for server functions)
CREATE POLICY "Service role can manage all orders" ON public.orders
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
