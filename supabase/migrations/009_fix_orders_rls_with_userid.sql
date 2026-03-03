-- Orders tablosu structure kontrolü ve RLS fix
-- Önce tabloyu kontrol et
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Eğer user_id yoksa ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- RLS policy'leri güvenli hale getir
DROP POLICY IF EXISTS "Enable all access for ALL" ON public.orders;

-- Kullanıcı kendi siparişlerini görebilir
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- Kullanıcı kendi siparişlerini oluşturabilir
CREATE POLICY "Users can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Kullanıcı kendi siparişlerini güncelleyebilir
CREATE POLICY "Users can update their own orders" ON public.orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin tüm siparişleri yönetebilir
CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'authenticated' AND 
    auth.jwt() ->> 'user_data' ->> 'role' IN ('admin', 'controller')
  );
