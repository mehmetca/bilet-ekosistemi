-- Update Empty Buyer Names - Single Statement
-- This updates empty buyer_name fields in existing orders

UPDATE public.orders 
SET buyer_name = COALESCE(buyer_name, 'Bilet Alıcı')
WHERE buyer_name IS NULL OR buyer_name = '' OR TRIM(buyer_name) = '';
