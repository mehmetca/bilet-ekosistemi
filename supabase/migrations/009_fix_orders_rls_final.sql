-- Orders RLS policy fix (conflict resolution)
-- Önce tüm mevcut policy'leri drop et
DROP POLICY IF EXISTS "Enable all access for ALL" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

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

-- Admin tüm siparişleri yönetebilir
CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL USING (
    auth.jwt() -> 'role' = '"authenticated"' AND 
    auth.jwt() -> 'user_data' -> 'role' IN ('"admin"', '"controller"')
  );
