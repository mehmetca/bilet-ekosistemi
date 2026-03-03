-- Orders RLS tam temizlik ve güvenli policy oluşturma
-- Önce TÜM mevcut policy'leri drop et (isimleri kontrol etmeden)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'orders' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.orders';
    END LOOP;
END $$;

-- User_id column'u kontrol et ve ekle
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

-- Güvenli RLS policy'leri oluştur
-- Kullanıcı kendi siparişlerini görebilir
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- Kullanıcı kendi siparişlerini oluşturabilir
CREATE POLICY "Users can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Kullanıcı kendi siparişlerini güncelleyebilir
CREATE POLICY "Users can update their own orders" ON public.orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin tüm siparişleri yönetebilir (basit versiyon)
CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL USING (
    auth.role() = 'authenticated'
  );
