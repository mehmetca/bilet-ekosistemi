-- Tüm demo siparişlerini sil (orders ve order_seats tabloları)
-- NOT: Bu sadece development/demo ortamı için kullanılmalıdır!

-- 1) Önce order_seats (child) kayıtlarını sil
DELETE FROM public.order_seats;

-- 2) Sonra orders (parent) kayıtlarını sil
DELETE FROM public.orders;

-- 3) Eğer seat_holds tablosu varsa, onu da temizle (opsiyonel)
-- DELETE FROM public.seat_holds WHERE created_at < NOW() - INTERVAL '1 day';
