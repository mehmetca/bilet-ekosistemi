-- Organizatörler kendi oluşturdukları etkinliklere bilet ekleyebilmeli.
-- Mevcut tickets politikaları sadece admin'e izin veriyor; organizer için ekleniyor.

-- Organizatör: Kendi etkinliğine (created_by_user_id = auth.uid()) bilet ekleyebilir
CREATE POLICY "Organizer can insert tickets for own events" ON public.tickets
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.created_by_user_id = auth.uid()
    )
  );

-- Organizatör: Kendi etkinliğinin biletlerini güncelleyebilir
CREATE POLICY "Organizer can update tickets for own events" ON public.tickets
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.created_by_user_id = auth.uid()
    )
  );

-- Organizatör: Kendi etkinliğinin biletlerini silebilir
CREATE POLICY "Organizer can delete tickets for own events" ON public.tickets
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'organizer')
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.created_by_user_id = auth.uid()
    )
  );
