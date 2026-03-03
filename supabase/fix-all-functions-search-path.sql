-- Fix all functions with search_path issues
-- This adds SET search_path = public to all SECURITY DEFINER functions

-- Fix set_updated_at function
DROP FUNCTION IF EXISTS public.set_updated_at;

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
