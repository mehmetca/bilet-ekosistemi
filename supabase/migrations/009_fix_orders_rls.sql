-- Orders tablosu RLS policy güvenli hale getirme
-- Önce mevcut policy'leri drop et
DROP POLICY IF EXISTS "Enable all access for ALL" ON public.orders;

-- Güvenli RLS policy'leri oluştur
-- Kullanıcı kendi siparişlerini görebilir
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- Kullanıcı kendi siparişlerini oluşturabilir
CREATE POLICY "Users can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Kullanıcı kendi siparişlerini güncelleyebilir (eğer izinliyse)
CREATE POLICY "Users can update their own orders" ON public.orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin tüm siparişleri yönetebilir
CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'authenticated' AND 
    auth.jwt() ->> 'user_data' ->> 'role' IN ('admin', 'controller')
  );
