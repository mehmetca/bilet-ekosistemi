-- 092: Organizatör seating yazımı yalnızca "kendi etkinliğine bağlı plan" ile sınırlıydı;
-- yeni salon oluştururken hiç etkinlik seating_plan_id ile işaret olmadığından INSERT imkansızdı.
-- Çözüm: Geçerli mekana (venues) bağlı ve henüz hiç etkinlik tarafından kullanılmayan plan = taslak;
-- bu planlarda tüm organizatörler düzenleyebilir (ortak mekan kataloğu). Başka organizatörün
-- etkinliğine bağlı planlarda yalnızca o etkinliğin sahibi yazar.

DROP POLICY IF EXISTS "Organizers manage seating_plans" ON public.seating_plans;
CREATE POLICY "Organizers manage seating_plans" ON public.seating_plans
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
    AND (
      EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.seating_plan_id = seating_plans.id
          AND e.created_by_user_id = auth.uid()
      )
      OR (
        EXISTS (SELECT 1 FROM public.venues v WHERE v.id = seating_plans.venue_id)
        AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.seating_plan_id = seating_plans.id)
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
    AND (
      EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.seating_plan_id = seating_plans.id
          AND e.created_by_user_id = auth.uid()
      )
      OR (
        EXISTS (SELECT 1 FROM public.venues v WHERE v.id = seating_plans.venue_id)
        AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.seating_plan_id = seating_plans.id)
      )
    )
  );

DROP POLICY IF EXISTS "Organizers manage seating_plan_sections" ON public.seating_plan_sections;
CREATE POLICY "Organizers manage seating_plan_sections" ON public.seating_plan_sections
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.seating_plans sp
      WHERE sp.id = seating_plan_sections.seating_plan_id
        AND (
          EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.seating_plan_id = sp.id AND e.created_by_user_id = auth.uid()
          )
          OR (
            EXISTS (SELECT 1 FROM public.venues v WHERE v.id = sp.venue_id)
            AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.seating_plan_id = sp.id)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.seating_plans sp
      WHERE sp.id = seating_plan_sections.seating_plan_id
        AND (
          EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.seating_plan_id = sp.id AND e.created_by_user_id = auth.uid()
          )
          OR (
            EXISTS (SELECT 1 FROM public.venues v WHERE v.id = sp.venue_id)
            AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.seating_plan_id = sp.id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Organizers manage seating_plan_rows" ON public.seating_plan_rows;
CREATE POLICY "Organizers manage seating_plan_rows" ON public.seating_plan_rows
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
    AND EXISTS (
      SELECT 1
      FROM public.seating_plan_sections s
      JOIN public.seating_plans sp ON sp.id = s.seating_plan_id
      WHERE s.id = seating_plan_rows.section_id
        AND (
          EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.seating_plan_id = sp.id AND e.created_by_user_id = auth.uid()
          )
          OR (
            EXISTS (SELECT 1 FROM public.venues v WHERE v.id = sp.venue_id)
            AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.seating_plan_id = sp.id)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
    AND EXISTS (
      SELECT 1
      FROM public.seating_plan_sections s
      JOIN public.seating_plans sp ON sp.id = s.seating_plan_id
      WHERE s.id = seating_plan_rows.section_id
        AND (
          EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.seating_plan_id = sp.id AND e.created_by_user_id = auth.uid()
          )
          OR (
            EXISTS (SELECT 1 FROM public.venues v WHERE v.id = sp.venue_id)
            AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.seating_plan_id = sp.id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Organizers manage seats" ON public.seats;
CREATE POLICY "Organizers manage seats" ON public.seats
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
    AND EXISTS (
      SELECT 1
      FROM public.seating_plan_rows r
      JOIN public.seating_plan_sections s ON s.id = r.section_id
      JOIN public.seating_plans sp ON sp.id = s.seating_plan_id
      WHERE r.id = seats.row_id
        AND (
          EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.seating_plan_id = sp.id AND e.created_by_user_id = auth.uid()
          )
          OR (
            EXISTS (SELECT 1 FROM public.venues v WHERE v.id = sp.venue_id)
            AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.seating_plan_id = sp.id)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'organizer')
    AND EXISTS (
      SELECT 1
      FROM public.seating_plan_rows r
      JOIN public.seating_plan_sections s ON s.id = r.section_id
      JOIN public.seating_plans sp ON sp.id = s.seating_plan_id
      WHERE r.id = seats.row_id
        AND (
          EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.seating_plan_id = sp.id AND e.created_by_user_id = auth.uid()
          )
          OR (
            EXISTS (SELECT 1 FROM public.venues v WHERE v.id = sp.venue_id)
            AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.seating_plan_id = sp.id)
          )
        )
    )
  );

COMMENT ON POLICY "Organizers manage seating_plans" ON public.seating_plans IS
  'Organizatör: kendi etkinliğinin seating_plan_id ''si veya mevcut mekanda henüz etkinliğe bağlı olmayan taslak plan.';
