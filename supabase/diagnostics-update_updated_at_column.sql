-- Tanı: public.update_updated_at_column() — Supabase SQL Editor'da çalıştırın.
-- Amaç: SECURITY DEFINER / RPC uyarısını netleştirmek + hangi tablolarda tetik var görmek.

-- 1) Fonksiyon kimliği ve SECURITY DEFINER mı?
--    prosecdef = true → SECURITY DEFINER
SELECT
  p.oid,
  n.nspname AS schema_name,
  p.proname,
  p.prosecdef AS is_security_definer,
  pg_get_function_identity_arguments(p.oid) AS identity_args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'update_updated_at_column';

-- 2) Bu fonksiyona bağlı kullanıcı tetikleri (tablo listesi)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid, true) AS trigger_def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND p.proname = 'update_updated_at_column'
ORDER BY 1, 2, 3;

-- 3) Kim EXECUTE edebilir? (Advisor uyarısı buradan doğrulanır)
SELECT
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'update_updated_at_column'
ORDER BY grantee;

-- 4) Aynı işi yapan diğer updated_at yardımcıları (projede sıkça set_updated_at de geçer)
SELECT
  n.nspname,
  p.proname,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('update_updated_at_column', 'set_updated_at')
ORDER BY p.proname;
