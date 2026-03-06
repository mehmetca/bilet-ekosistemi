-- Mevcut siparişlere user_id ekle: buyer_email ile auth.users.email eşleşenler
-- Böylece eski siparişler de Biletlerim sayfasında görünür
UPDATE public.orders o
SET user_id = u.id
FROM auth.users u
WHERE o.user_id IS NULL
  AND o.buyer_email IS NOT NULL
  AND o.buyer_email != ''
  AND LOWER(TRIM(o.buyer_email)) = LOWER(TRIM(u.email));
