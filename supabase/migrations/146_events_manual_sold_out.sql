-- Etkinlikte bilet stoğu fiilen bitmese bile "Bilet tükendi" göstermek için yönetici anahtarı.
-- Organizatör "biletler tükendi" dediğinde stoğu bilmediğimiz için etkinliği taslağa almak yerine bu işaret kullanılır.
alter table public.events add column if not exists manual_sold_out boolean not null default false;

comment on column public.events.manual_sold_out is
  'true ise site bu etkinliği her dilde "Bilet tükendi" olarak gösterir ve satış kilitlenir';
