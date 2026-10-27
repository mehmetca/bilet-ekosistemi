-- Slider kartlarini elle siralamak icin: advertisements.sort_order
-- Yeni kart API tarafından max+1 ile listenin sonuna eklenir; panel yukari/asagi ile yer degistirir.
alter table public.advertisements add column if not exists sort_order integer not null default 0;

-- Mevcut gorunum korunur: bugunku sira (en yeni en basita) 0,1,2... olarak yazilir.
with s as (
  select id, (row_number() over (order by created_at desc))::int - 1 as n
  from public.advertisements
)
update public.advertisements a
set sort_order = s.n
from s
where a.id = s.id;
