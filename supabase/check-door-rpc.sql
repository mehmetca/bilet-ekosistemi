-- Kapı RPC'si hata veriyor: hangi parça eksik/bozuk, tek çalıştırmada gör.
-- Dashboard > SQL Editor'da bu projenin (dev sunucunun bağlandığı) panelinde çalıştır.

select current_database() as db;

-- 1) Fonksiyonlar ve TAM imzaları (121: check_ticket_door, 122: +log_ticket_check, 123: stats)
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       r.rolname as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.proname in ('check_ticket_door', 'log_ticket_check', 'get_event_door_stats')
order by p.proname;

-- 2) code_key kolonları: listelenmezse 121'in ALTER adımları başarısız olmuş
select table_name, column_name, is_generated, generation_expression
from information_schema.columns
where table_schema = 'public' and column_name = 'code_key'
order by table_name;

-- 3) Arama indeksleri + log tablosu
select indexname from pg_indexes
where schemaname = 'public'
  and indexname in ('idx_orders_code_key', 'idx_order_seats_code_key', 'idx_order_ticket_units_code_key')
order by indexname;

select to_regclass('public.ticket_check_logs') as ticket_check_logs;

-- 4) GRANT doğrulaması (false ise uygulama 42501 alır)
select pg_catalog.has_function_privilege(
         'service_role',
         'public.check_ticket_door(text, uuid, boolean, uuid, uuid, uuid[])',
         'execute') as service_role_can_execute;

-- 5) Fonksiyonu DOĞRUDAN çağır: eksik/yanlış kolon-tablo hatası burada patlar.
--    UYARI: 122 uygulandıysa bu sorgu ticket_check_logs'a tek bir 'invalid' satırı yazar.
select public.check_ticket_door('BLT-DIAGTEST0', null, false, null, null, null) as door_result;
select public.get_event_door_stats(null) as stats_probe;

-- 6) PostgREST şema önbelleği tazelenmezse uygulama "function not found" (PGRST202) görür.
notify pgrst, 'reload schema';

-- 5. adımın artığını temizlemek için:
-- delete from public.ticket_check_logs where code_key = 'BLT-DIAGTEST0';
