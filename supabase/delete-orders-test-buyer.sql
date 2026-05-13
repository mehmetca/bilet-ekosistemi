-- Test / deneme siparişlerini belirli bir alıcıya göre silme
-- Supabase Dashboard → SQL Editor’de service role / postgres olarak çalıştırın.
-- ÖNEMLİ: Önce 1. bölümdeki SELECT ile silinecekleri kontrol edin; sonra 2. ve 3.’yü sırayla çalıştırın.

-- =====================================================================
-- 1) ÖNİZLEME — Sadece listeler (silmez)
-- =====================================================================
SELECT
  o.id,
  o.buyer_email,
  o.user_id,
  o.ticket_id,
  o.quantity,
  o.total_price,
  o.status,
  o.created_at
FROM public.orders o
WHERE lower(trim(coalesce(o.buyer_email, ''))) = lower(trim('admin@bilet-ekosistemi.com'))
   OR o.user_id = (SELECT id FROM auth.users WHERE email = 'admin@bilet-ekosistemi.com' LIMIT 1)
ORDER BY o.created_at DESC;

-- =====================================================================
-- 2) STOK GERİ YÜKLEME — Bu alıcıya ait siparişlerdeki adetleri bilete iade eder
-- =====================================================================
WITH target AS (
  SELECT o.ticket_id, o.quantity
  FROM public.orders o
  WHERE lower(trim(coalesce(o.buyer_email, ''))) = lower(trim('admin@bilet-ekosistemi.com'))
     OR o.user_id = (SELECT id FROM auth.users WHERE email = 'admin@bilet-ekosistemi.com' LIMIT 1)
),
by_ticket AS (
  SELECT ticket_id, sum(quantity)::int AS qty_sum
  FROM target
  WHERE ticket_id IS NOT NULL
  GROUP BY ticket_id
)
UPDATE public.tickets t
SET
  available = least(
    coalesce(t.quantity, 0),
    coalesce(t.available, 0) + bt.qty_sum
  ),
  updated_at = now()
FROM by_ticket bt
WHERE t.id = bt.ticket_id;

-- =====================================================================
-- 3) SİPARİŞLERİ SİL — order_seats ve order_ticket_units ON DELETE CASCADE ile gider
-- =====================================================================
DELETE FROM public.orders o
WHERE lower(trim(coalesce(o.buyer_email, ''))) = lower(trim('admin@bilet-ekosistemi.com'))
   OR o.user_id = (SELECT id FROM auth.users WHERE email = 'admin@bilet-ekosistemi.com' LIMIT 1);

-- Ayrıca belirli bir deneme etkinliğini (ör. "Farqin Azad Konseri") komple kaldırmak için:
-- supabase/delete-demo-event-farqin-azad-konseri.sql dosyasına bakın.
