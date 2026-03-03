-- Events Tablosu RLS Policy'leri Düzelt
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- Mevcut policy'leri kaldır
DROP POLICY IF EXISTS "Enable insert for all users" ON public.events;
DROP POLICY IF EXISTS "Enable select for all users" ON public.events;
DROP POLICY IF EXISTS "Enable update for all users" ON public.events;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.events;

-- Yeni policy'ler oluştur - sadece authenticated kullanıcılar
CREATE POLICY "Etkinlikleri authenticated kullanıcılar okuyabilir"
  ON public.events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Etkinlikleri authenticated kullanıcılar ekleyebilir"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Etkinlikleri authenticated kullanıcılar güncelleyebilir"
  ON public.events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Etkinlikleri authenticated kullanıcılar silebilir"
  ON public.events FOR DELETE
  TO authenticated
  USING (true);

-- RLS'in aktif olduğundan emin ol
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
