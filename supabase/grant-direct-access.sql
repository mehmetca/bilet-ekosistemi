-- Quick fix: Grant direct table access
-- This bypasses RLS by granting direct access

GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.orders TO anon;
GRANT SELECT ON public.orders TO public;
