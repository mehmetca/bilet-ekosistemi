-- Gişe kasası (vardiya): görevli gün başında elindeki bozma parasıyla kasayı açar,
-- gün sonunda saydığı parayı girer; sistem nakit satışlardan beklenen tutarı ve farkı yazar.
-- Kapıda davetiye (ücretsiz) kesilebilmesi için orders.door_payment türü genişletilir.

alter table public.orders drop constraint if exists orders_door_payment_check;
alter table public.orders
  add constraint orders_door_payment_check
  check (door_payment is null or door_payment in ('cash', 'card', 'free'));

create table if not exists public.door_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  opening_amount numeric(10,2) not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  counted_cash numeric(10,2),
  expected_cash numeric(10,2),
  difference numeric(10,2),
  note text
);

create index if not exists door_cash_sessions_staff_status_idx
  on public.door_cash_sessions (staff_id, status, opened_at desc);

create index if not exists door_cash_sessions_event_opened_idx
  on public.door_cash_sessions (event_id, opened_at desc);

comment on table public.door_cash_sessions is
  'Gişe görevlisinin kasa vardiyası: açılış parası, kapanışta sayılan para ve beklenen/fark.';

comment on column public.door_cash_sessions.expected_cash is
  'Kapanışta hesaplanan beklenen nakit: açılış parası + vardiyada kesilen nakit kapı satışları.';

comment on column public.door_cash_sessions.difference is
  'Sayılan para - beklenen para. Pozitif fazla, negatif açık.';

alter table public.door_cash_sessions enable row level security;

drop policy if exists "Admin can manage door cash sessions" on public.door_cash_sessions;
create policy "Admin can manage door cash sessions"
  on public.door_cash_sessions
  for all
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Staff can open own door cash session" on public.door_cash_sessions;
create policy "Staff can open own door cash session"
  on public.door_cash_sessions
  for insert
  with check (staff_id = auth.uid());

drop policy if exists "Staff can view own door cash sessions" on public.door_cash_sessions;
create policy "Staff can view own door cash sessions"
  on public.door_cash_sessions
  for select
  using (staff_id = auth.uid());

drop policy if exists "Staff can close own door cash session" on public.door_cash_sessions;
create policy "Staff can close own door cash session"
  on public.door_cash_sessions
  for update
  using (staff_id = auth.uid())
  with check (staff_id = auth.uid());

-- Kasa vardiyasının nakit özeti: sipariş taramasını sunucuda tek istekte toplar.
-- orders RLS'i personel için kapalı olduğundan SECURITY DEFINER; yalnız service_role çağırır.
create or replace function public.door_cash_summary(
  p_staff_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_event_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'cash_total', coalesce(sum(o.total_price) filter (
      where o.door_payment = 'cash' and o.status::text = 'completed'), 0),
    'card_total', coalesce(sum(o.total_price) filter (
      where o.door_payment = 'card' and o.status::text = 'completed'), 0),
    'tickets', coalesce(sum(o.quantity) filter (
      where o.status::text = 'completed'), 0),
    'orders', coalesce(count(*) filter (
      where o.status::text = 'completed'), 0),
    'free_tickets', coalesce(sum(o.quantity) filter (
      where o.door_payment = 'free' and o.status::text = 'completed'), 0),
    'cancelled', coalesce(count(*) filter (
      where o.status::text <> 'completed'), 0)
  )
  from public.orders o
  where o.sales_channel = 'door'
    and o.sold_by = p_staff_id
    and o.created_at >= p_from
    and (p_to is null or o.created_at <= p_to)
    and (p_event_id is null or o.event_id = p_event_id);
$$;

comment on function public.door_cash_summary is
  'Gişe kasası özeti: verilen görevli / zaman aralığı / etkinlik için nakit-kart-davetiye toplamları ve sayaçlar.';

revoke all on function public.door_cash_summary(uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.door_cash_summary(uuid, timestamptz, timestamptz, uuid)
  to service_role;

-- PostgREST yeni tabloyu ve genişleyen check'i görebilsin (self-host'da şart).
notify pgrst, 'reload schema';
