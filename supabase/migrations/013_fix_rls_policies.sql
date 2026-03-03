-- RLS policy'lerini güvenli hale getirme
-- Önce mevcut policy'leri drop et
DROP POLICY IF EXISTS "Enable read access for all users" ON public.advertisements;
DROP POLICY IF EXISTS "Admins can manage advertisements" ON public.advertisements;

-- Güvenli policy'ler oluştur
-- Sadece authenticated kullanıcılar okuyabilir
CREATE POLICY "Users can read active advertisements" ON public.advertisements
  FOR SELECT USING (is_active = true AND auth.role() = 'authenticated');

-- Sadece admin/controller yönetebilir
CREATE POLICY "Admins can manage advertisements" ON public.advertisements
  FOR ALL USING (
    auth.role() = 'authenticated' AND 
    auth.jwt() -> 'user_data' ->> 'role' IN ('admin', 'controller')
  );

-- Data kontrolü
SELECT id, title, image_url, link_url, placement, is_active
FROM public.advertisements 
WHERE is_active = true
ORDER BY placement, created_at DESC;
