-- mcantoprak@gmail.com kullanıcısının TÜM biletlerini sil
-- Önce order_seats (child) kayıtlarını sil
DELETE FROM public.order_seats 
WHERE order_id IN (
  SELECT id FROM public.orders 
  WHERE buyer_email = 'mcantoprak@gmail.com'
);

-- Sonra orders (parent) kayıtlarını sil
DELETE FROM public.orders 
WHERE buyer_email = 'mcantoprak@gmail.com';
