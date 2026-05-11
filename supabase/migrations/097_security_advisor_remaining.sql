-- Kalan Advisor uyarıları: elle eklenmiş RPC'ler, tetikleyici DEFINER, storage geniş SELECT.
-- Auth "leaked password protection" yalnızca Dashboard → Authentication ayarından açılır.

-- ---------------------------------------------------------------------------
-- 1) Tetikleyici updated_at: SECURITY INVOKER (lint 0029 authenticated DEFINER)
--    Yalnızca NEW satırını günceller; çağıran rolün INSERT/UPDATE yetkisi yeterli.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.set_updated_at() SECURITY INVOKER;
ALTER FUNCTION public.update_updated_at_column() SECURITY INVOKER;

-- ---------------------------------------------------------------------------
-- 2) Elle eklenmiş / çoklu imzalı RPC: EXECUTE yalnızca service_role
--    TRIGGER dönüşlü fonksiyonlarda authenticated REVOKE yapılmaz (tetikleyici çalışması için).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_trigger_oid oid;
BEGIN
  SELECT oid INTO v_trigger_oid FROM pg_catalog.pg_type WHERE typname = 'trigger';

  FOR r IN
    SELECT
      p.proname,
      p.prorettype,
      p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_user_role',
        'is_admin',
        'is_controller',
        'rls_auto_enable',
        'minimal_insert_order',
        'simple_insert_order'
      )
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);

      IF r.prorettype IS DISTINCT FROM v_trigger_oid THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
      END IF;

      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Storage: public bucket için geniş SELECT (liste) politikaları
--    Public URL ile nesne okuma çoğu kurulumda çalışmaya devam eder; sorun olursa
--    Dashboard → Storage → politikayı daha dar kurallı yeniden ekleyin.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Advertisements images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Artist images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "artists 1o4y39n_0" ON storage.objects;
DROP POLICY IF EXISTS "Event images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Herkes resimleri görebilir" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access 1o4y39n_0" ON storage.objects;
DROP POLICY IF EXISTS "Tour event images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access for event-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access for artists" ON storage.objects;
