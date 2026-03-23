-- Organizatörler: oturum planı, bölüm, sıra, koltuk CRUD (admin/controller ile aynı kapsam)
-- Not: Mekan (venues) oluşturma ayrı politikada kalır; salon düzenini organizatör yönetebilir.

CREATE POLICY "Organizers manage seating_plans" ON public.seating_plans
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
  );

CREATE POLICY "Organizers manage seating_plan_sections" ON public.seating_plan_sections
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
  );

CREATE POLICY "Organizers manage seating_plan_rows" ON public.seating_plan_rows
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
  );

CREATE POLICY "Organizers manage seats" ON public.seats
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
  );
