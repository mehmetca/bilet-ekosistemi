-- Test biletlerini sil - Supabase SQL Editor'de çalıştırın
-- ÖNCE 1. sorguyu çalıştırıp silinecekleri kontrol edin!

-- 1. SİLİNECEKLERİ ÖNCE GÖRÜN (kontrol için)
SELECT id, buyer_email, buyer_name, ticket_code, quantity, total_price, created_at
FROM public.orders
ORDER BY created_at DESC;

-- 2. TÜM SİPARİŞLERİ SİL (dikkat: geri alınamaz!)
-- DELETE FROM public.orders;

-- 3. SADECE BELİRLİ E-POSTA İLE SİL (test@... gibi)
-- 'test@example.com' yerine kendi test e-postanızı yazın
-- DELETE FROM public.orders WHERE LOWER(buyer_email) = 'test@example.com';

-- 4. BELİRLİ TARİHTEN ÖNCEKİ SİPARİŞLERİ SİL
-- DELETE FROM public.orders WHERE created_at < '2025-03-01';
