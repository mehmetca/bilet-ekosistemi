-- hero_background_auto_sort() reklamlardaki "placement" kolonunu okuyordu;
-- hero_backgrounds'ta böyle bir kolon yok, bu yüzden her INSERT 42703 ile patlıyordu.
create or replace function public.hero_background_auto_sort()
returns trigger
language plpgsql
as $$
begin
  new.sort_order = coalesce((select max(sort_order) + 1 from public.hero_backgrounds), 1);
  return new;
end;
$$;

drop trigger if exists hero_background_auto_sort on public.hero_backgrounds;
create trigger hero_background_auto_sort
  before insert on public.hero_backgrounds
  for each row execute function public.hero_background_auto_sort();
