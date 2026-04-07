-- Events tablosuna is_draft kolonu ekle (sadece admin görebilir)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- Mevcut etkinlikler is_draft = false olsun (herkes görebilir)
UPDATE public.events 
SET is_draft = false 
WHERE is_draft IS NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_events_is_draft ON public.events(is_draft);

-- RLS Policy güncelle - Normal kullanıcılar sadece is_draft = false görebilir
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Admin can manage events" ON public.events;
DROP POLICY IF EXISTS "Users can view active events" ON public.events;

-- Herkes aktif etkinlikleri görebilir (is_draft = false)
CREATE POLICY "Everyone can view published events" ON public.events
  FOR SELECT USING (is_active = true AND (is_draft = false OR is_draft IS NULL));

-- Admin tüm etkinlikleri yönetebilir
CREATE POLICY "Admin can manage all events" ON public.events
  FOR ALL USING (
    auth.role() = 'authenticated' AND 
    auth.jwt() -> 'user_data' ->> 'role' IN ('admin', 'controller')
  );

-- Kontrol
SELECT 
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE is_draft = true) as draft_events,
  COUNT(*) FILTER (WHERE is_draft = false OR is_draft IS NULL) as published_events
FROM public.events 
WHERE is_active = true;
