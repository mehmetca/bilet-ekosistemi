-- Sanatçı takip: Kullanıcılar sanatçıyı takip edebilir
CREATE TABLE IF NOT EXISTS public.artist_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_follows_artist_id ON public.artist_follows(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_follows_user_id ON public.artist_follows(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_follows_unique_user ON public.artist_follows(artist_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_follows_unique_session ON public.artist_follows(artist_id, session_id) WHERE session_id IS NOT NULL;

ALTER TABLE public.artist_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert artist_follows" ON public.artist_follows FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete own artist_follows" ON public.artist_follows FOR DELETE USING (true);
CREATE POLICY "Admins can select all artist_follows" ON public.artist_follows FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
);

-- Etkinlik favori: Kullanıcılar etkinliği favorilere ekleyebilir
CREATE TABLE IF NOT EXISTS public.event_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_favorites_event_id ON public.event_favorites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_favorites_user_id ON public.event_favorites(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_favorites_unique_user ON public.event_favorites(event_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_favorites_unique_session ON public.event_favorites(event_id, session_id) WHERE session_id IS NOT NULL;

ALTER TABLE public.event_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert event_favorites" ON public.event_favorites FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete event_favorites" ON public.event_favorites FOR DELETE USING (true);
CREATE POLICY "Admins can select all event_favorites" ON public.event_favorites FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
);
