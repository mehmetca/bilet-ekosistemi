-- Advertisements RLS: admin yetkisi user_roles üzerinden (JWT user_data.role yok)
-- Eski policy'ler güncellemeyi sessizce 0 satıra düşürüp "boş sonuç" hatasına yol açabiliyordu.

DROP POLICY IF EXISTS "Enable read access for all users" ON public.advertisements;
DROP POLICY IF EXISTS "Users can read active advertisements" ON public.advertisements;
DROP POLICY IF EXISTS "Advertisements are viewable by everyone" ON public.advertisements;
DROP POLICY IF EXISTS "Admins can manage advertisements" ON public.advertisements;

-- Herkes aktif reklamları okuyabilir (anon + authenticated)
CREATE POLICY "Anyone can read active advertisements"
  ON public.advertisements
  FOR SELECT
  USING (is_active = true);

-- Admin tüm kayıtları okuyabilir (pasif dahil)
CREATE POLICY "Admins can read all advertisements"
  ON public.advertisements
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admin ekleme / güncelleme / silme
CREATE POLICY "Admins can insert advertisements"
  ON public.advertisements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update advertisements"
  ON public.advertisements
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete advertisements"
  ON public.advertisements
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
