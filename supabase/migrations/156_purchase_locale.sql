-- 156: Satın alma sayfasının dili bilet mailinde kullanılıyor.
-- Mevcut satırlar NULL kalır → mail bugünkü gibi Türkçe gider (panel/kapı satışı da NULL).

alter table public.stripe_checkout_intents
  add column if not exists locale text;

alter table public.orders
  add column if not exists locale text;
