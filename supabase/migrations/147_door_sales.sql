-- 147_door_sales.sql
-- Gişe (kapıda) satış kaydı: siparişin çevrimiçi mi yoksa kapıda mı satıldığını,
-- kapıda nakit mi kart mı tahsil edildiğini ve bileti kimin kestiğini tutar.
-- Mevcut satırlar 'online' kalır; eski akışlar hiç etkilenmez.

alter table public.orders
  add column if not exists sales_channel text not null default 'online',
  add column if not exists door_payment text,
  add column if not exists sold_by uuid,
  add column if not exists door_note text;

alter table public.orders drop constraint if exists orders_sales_channel_check;
alter table public.orders
  add constraint orders_sales_channel_check check (sales_channel in ('online', 'door'));

alter table public.orders drop constraint if exists orders_door_payment_check;
alter table public.orders
  add constraint orders_door_payment_check check (door_payment is null or door_payment in ('cash', 'card'));

-- Kapı satışı müşterisiz olabilir: gişede e-posta vermeyen alıcı için alan boş kalır.
alter table public.orders alter column buyer_email drop not null;

create index if not exists orders_event_door_created_idx
  on public.orders (event_id, sales_channel, created_at desc);

-- PostgREST yeni kolonları görebilsin (self-host'da şart).
notify pgrst, 'reload schema';
