CREATE POLICY "Admins can insert orders" ON public.orders
  FOR INSERT WITH CHECK (
    (SELECT auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );
