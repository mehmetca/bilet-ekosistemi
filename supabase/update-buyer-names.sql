-- Quick Fix for Empty Buyer Names
-- This updates empty buyer_name fields in existing orders

-- Update orders with empty buyer_name
UPDATE public.orders 
SET buyer_name = 'Bilet Alıcı'
WHERE buyer_name IS NULL OR buyer_name = '' OR TRIM(buyer_name) = '';

-- Show the result
SELECT 
  'UPDATE COMPLETE' as status,
  COUNT(*) as updated_orders,
  'buyer_name set to Bilet Alıcı for empty fields' as action
FROM public.orders 
WHERE buyer_name = 'Bilet Alıcı';

-- Verify all orders now have buyer_name
SELECT 
  'VERIFICATION' as status,
  CASE 
    WHEN COUNT(*) = COUNT(CASE WHEN buyer_name IS NULL OR buyer_name = '' THEN 1 END) 
    THEN 'STILL EMPTY'
    ELSE 'ALL FILLED'
  END as buyer_name_status,
  COUNT(*) as total_orders
FROM public.orders;
