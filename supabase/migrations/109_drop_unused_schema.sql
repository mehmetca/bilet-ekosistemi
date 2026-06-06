-- Kullanılmayan tablolar, legacy kolon ve ölü RPC temizliği.
-- Uygulama: news / ab_* sorgulanmıyor; purchase reserve_ticket_stock + orders.insert kullanıyor.

-- A/B test altyapısı (migration 029, uygulamada referans yok)
DROP TABLE IF EXISTS public.ab_variants CASCADE;
DROP TABLE IF EXISTS public.ab_experiments CASCADE;

-- Haber modülü kaldırıldı; advertisements.placement=news_slider ayrı (news tablosu değil)
DROP TABLE IF EXISTS public.news CASCADE;

-- Turneler sayfası kaldırıldı (migration 019); kolon artık kullanılmıyor
ALTER TABLE public.artists DROP COLUMN IF EXISTS show_on_tour_page;

-- Atomik sipariş RPC kullanılmıyor; stok: reserve_ticket_stock
DROP FUNCTION IF EXISTS public.reserve_tickets_and_create_order(
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text
);
