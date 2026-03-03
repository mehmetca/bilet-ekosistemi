-- Fix set_updated_at function with CASCADE
-- This drops the trigger first, then recreates the function

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
DROP FUNCTION IF EXISTS public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;
