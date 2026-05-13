-- "Farqin Azad Konseri" deneme etkinliği: Bu etkinliğe bağlı TÜM siparişleri (kim aldıysa) stok iadesiyle sil,
-- ardından etkinlik kaydını kaldırır (bilet satırları, bağımlı kayıtlar CASCADE ile gider).
--
-- Supabase Dashboard → SQL Editor (postgres / service role yeterli hak).
-- Önce 1) sonra 2); ardından 3) ve 4) — sıra önemli: önce siparişler, sonra etkinlik (fk_event CASCADE olmayabilir).

-- =====================================================================
-- Ayar: Tam etkinlik adına göre eşleşme (gerekirse tek satırda değiştirin)
-- =====================================================================
-- Varsayılan: başlıklarda "Farqin Azad Konseri" geçen etkinlikler (% ... % ile).
-- NOT: ILIKE büyük/küçük harfi duymaz.

-- =====================================================================
-- 1) ÖNİZLEME — Eşleşen etkinlikler + sipariş özeti (silmez)
-- =====================================================================
WITH matched AS (
  SELECT
    e.id,
    coalesce(e.title_tr, e.title) AS baslik,
    e.date AS etkinlik_tarihi
  FROM public.events e
  WHERE
    coalesce(e.title_tr, e.title, e.title_ku, e.title_ckb, e.title_de, e.title_en, '') ILIKE '%Farqin Azad Konseri%'
)
SELECT
  m.id,
  m.baslik,
  m.etkinlik_tarihi,
  (SELECT count(*)::int FROM public.orders o WHERE o.event_id = m.id) AS siparis_adedi,
  (SELECT coalesce(sum(o.quantity), 0)::bigint FROM public.orders o WHERE o.event_id = m.id) AS satilan_bilet_adedi
FROM matched m
ORDER BY m.etkinlik_tarihi DESC;

-- =====================================================================
-- 2) STOK GERİ YÜKLEME — Bu etkinlik(ler)deki tüm siparişlerdeki adeti biletlere iade eder
-- =====================================================================
WITH ev AS (
  SELECT e.id
  FROM public.events e
  WHERE
    coalesce(e.title_tr, e.title, e.title_ku, e.title_ckb, e.title_de, e.title_en, '') ILIKE '%Farqin Azad Konseri%'
),
target AS (
  SELECT o.ticket_id, o.quantity
  FROM public.orders o
  WHERE o.event_id IN (SELECT id FROM ev)
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
-- 3) SİPARİŞLERİ SİL — orders.event_id → events üzerinde CASCADE yoksa etkinlik silinemez (23503 önlenir).
-- order_seats / order_ticket_units siparişe CASCADE ise birlikte gider.
-- =====================================================================
DELETE FROM public.orders o
WHERE o.event_id IN (
  SELECT e.id
  FROM public.events e
  WHERE
    coalesce(e.title_tr, e.title, e.title_ku, e.title_ckb, e.title_de, e.title_en, '') ILIKE '%Farqin Azad Konseri%'
);

-- =====================================================================
-- 4) ETKİNLİĞİ SİL — bilet satırları genelde event_id CASCADE ile gider
-- =====================================================================
DELETE FROM public.events e
WHERE
  coalesce(e.title_tr, e.title, e.title_ku, e.title_ckb, e.title_de, e.title_en, '') ILIKE '%Farqin Azad Konseri%';
