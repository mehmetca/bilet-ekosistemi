CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE USING (
    (SELECT auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );
