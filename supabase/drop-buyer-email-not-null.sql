-- Fix buyer_email constraint to allow NULL values
ALTER TABLE public.orders ALTER COLUMN buyer_email DROP NOT NULL;
