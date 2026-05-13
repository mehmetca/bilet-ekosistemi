-- Supabase Data API (PostgREST / supabase-js): yeni projelerde public tablolara varsayılan
-- expose kalktı; eksik GRANT yüzünden "permission denied for table" oluşmasın diye tek seferlik
-- geniş izin takviyesi + ileriye dönük default privileges.
-- Satır güvenliği RLS politikalarında kalır; bu dosya yalnızca rol–nesne haklarını garanti eder.

-- Şema kullanımı (REST bağlamı için gerekli)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Mevcut tablolar (migration çalıştığı anda public'te görünen tüm tablolar)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- SERIAL / identity sıraları (INSERT sırasında nextval gerekebilir)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Bundan sonra bu roller tarafından oluşturulacak tablolar için varsayılan haklar.
-- Hosted Supabase’de sık görülen sahipler: postgres, supabase_admin
DO $$
DECLARE
  creator TEXT;
BEGIN
  FOREACH creator IN ARRAY ARRAY['postgres', 'supabase_admin']::text[]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = creator) THEN
      EXECUTE format(
        $f$
          ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
        $f$,
        creator
      );
      EXECUTE format(
        $f$
          ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
            GRANT SELECT ON TABLES TO anon;
        $f$,
        creator
      );
      EXECUTE format(
        $f$
          ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
            GRANT ALL ON TABLES TO service_role;
        $f$,
        creator
      );
      EXECUTE format(
        $f$
          ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
            GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
        $f$,
        creator
      );
      EXECUTE format(
        $f$
          ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
            GRANT USAGE, SELECT ON SEQUENCES TO service_role;
        $f$,
        creator
      );
    END IF;
  END LOOP;
END $$;
