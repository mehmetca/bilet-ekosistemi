-- Verify Buyer Names Update
-- Check if the update worked

SELECT 
  'VERIFICATION' as status,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN buyer_name IS NULL OR buyer_name = '' THEN 1 END) as empty_buyer_names,
  COUNT(CASE WHEN buyer_name = 'Bilet Alıcı' THEN 1 END) as filled_buyer_names
FROM public.orders;
