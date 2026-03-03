-- events tablosuna venue_id ekle (mekan bağlantısı)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events(venue_id);
