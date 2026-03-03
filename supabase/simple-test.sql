-- Basit bağlantı testi
SELECT 'Bağlantı başarılı' as status, COUNT(*) as order_count FROM public.orders;

-- Environment değişkenlerini kontrol et
-- (Bu sonuçları SQL Editor'da göremezsiniz, sadece backend'de çalışır)
