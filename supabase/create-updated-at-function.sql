-- set_updated_at Fonksiyonu Oluştur
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- updated_at alanını otomatik güncelleyen fonksiyon
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonksiyonun varlığını kontrol et
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE EXCEPTION 'set_updated_at fonksiyonu oluşturulamadı';
  END IF;
END $$;
