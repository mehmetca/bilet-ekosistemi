-- Events: Kurmancî (KU) kısa açıklama alanı
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description_ku TEXT;
