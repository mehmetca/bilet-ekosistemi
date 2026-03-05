-- Tur/gösteri gruplaması için show_slug (Biletinial tarzı sayfa)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS show_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_events_show_slug ON public.events(show_slug) WHERE show_slug IS NOT NULL;
