CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );
