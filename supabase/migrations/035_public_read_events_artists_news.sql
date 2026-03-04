-- events, artists, news tablolarına herkesin (anon) okuyabilmesi için RLS policy
-- Vercel'de içerik boş geliyorsa: 1) Bu migration'ı çalıştırın, 2) Vercel env değişkenlerini kontrol edin

-- events: herkes okuyabilsin (anon key ile client-side fetch için)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can read events" ON public.events;
    CREATE POLICY "Anyone can read events" ON public.events
      FOR SELECT USING (true);
  END IF;
END $$;

-- artists: herkes okuyabilsin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'artists') THEN
    ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can read artists" ON public.artists;
    CREATE POLICY "Anyone can read artists" ON public.artists
      FOR SELECT USING (true);
  END IF;
END $$;

-- news: herkes okuyabilsin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'news') THEN
    ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can read news" ON public.news;
    CREATE POLICY "Anyone can read news" ON public.news
      FOR SELECT USING (true);
  END IF;
END $$;

-- tickets: etkinlik detay sayfasında bilet listesi için herkes okuyabilsin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tickets') THEN
    ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anyone can read tickets" ON public.tickets;
    CREATE POLICY "Anyone can read tickets" ON public.tickets
      FOR SELECT USING (true);
  END IF;
END $$;
