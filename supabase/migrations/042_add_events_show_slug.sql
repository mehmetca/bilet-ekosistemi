-- Tur/gösteri gruplaması için show_slug (tek gösteri sayfası)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS show_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_events_show_slug ON public.events(show_slug) WHERE show_slug IS NOT NULL;
