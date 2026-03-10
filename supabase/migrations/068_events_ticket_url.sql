-- events tablosuna harici bilet linki (Bilet Al butonu için)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_url TEXT;

COMMENT ON COLUMN public.events.ticket_url IS 'Harici bilet satış sayfası URL; doluysa Bilet Al bu linke gider.';
