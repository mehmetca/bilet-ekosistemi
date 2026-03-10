-- Reddedilen etkinlikleri "incelemede"den ayırmak için
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

COMMENT ON COLUMN public.events.rejected_at IS 'Admin tarafından reddedilme tarihi; null ise henüz reddedilmedi.';
