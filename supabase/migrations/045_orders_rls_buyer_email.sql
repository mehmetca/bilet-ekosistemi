-- Kullanıcılar user_id olmayan siparişlerde buyer_email ile eşleşenleri de görebilsin
CREATE POLICY "Users can view orders by buyer_email" ON public.orders
  FOR SELECT USING (
    user_id IS NULL
    AND buyer_email IS NOT NULL
    AND LOWER(TRIM(buyer_email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', '')))
  );
