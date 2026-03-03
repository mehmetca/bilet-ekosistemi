-- Fix buyer_name constraint to allow NULL values
ALTER TABLE public.orders ALTER COLUMN buyer_name DROP NOT NULL;
