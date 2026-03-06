-- Siparişlerinizi kontrol edin
-- Supabase Dashboard > SQL Editor'de çalıştırın
-- Önce kendi email'inizi aşağıdaki 'YOUR_EMAIL' yerine yazın

-- 1. Tüm siparişler (son 50)
SELECT id, user_id, buyer_email, buyer_name, ticket_code, quantity, total_price, status, created_at
FROM public.orders
ORDER BY created_at DESC
LIMIT 50;

-- 2. Sizin siparişleriniz (email ile)
-- 'YOUR_EMAIL' yerine kendi email'inizi yazın
SELECT id, user_id, buyer_email, buyer_name, ticket_code, quantity, total_price, status, created_at
FROM public.orders
WHERE LOWER(TRIM(buyer_email)) = LOWER(TRIM('YOUR_EMAIL'))
   OR user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = LOWER(TRIM('YOUR_EMAIL')))
ORDER BY created_at DESC;

-- 3. user_id olmayan siparişler (backfill gerekebilir)
SELECT COUNT(*) as user_id_null_count
FROM public.orders
WHERE user_id IS NULL AND buyer_email IS NOT NULL;
