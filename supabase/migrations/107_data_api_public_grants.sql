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

-- İleriye dönük: migration’ı/submit eden kullanıcının public’te oluşturacağı tablo/sıra için varsayılan
-- haklar (FOR ROLE supabase_admin yazılmaz — Dashboard/çoğu bağlantı bunu yapma yetkisine sahip değildir).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
