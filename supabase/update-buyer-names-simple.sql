UPDATE public.orders 
SET buyer_name = COALESCE(buyer_name, 'Bilet Alıcı')
WHERE buyer_name IS NULL OR buyer_name = '' OR TRIM(buyer_name) = '';
