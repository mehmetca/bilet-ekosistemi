-- Amed Spor için toplam bilet kapasitesi alanı
-- Normal etkinlikler NULL bırakır, sadece Amed Spor gibi özel etkinliklerde değer kullanılır
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS max_tickets INTEGER NULL;

COMMENT ON COLUMN public.events.max_tickets IS 'Toplam bilet kapasitesi (Amed Spor gibi oturma planı olmayan etkinlikler için). NULL = sınırsız (normal etkinlikler)';

-- Özel form gerektiriyor mu (Amed Spor gibi etkinlikler için)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS has_custom_form BOOLEAN NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.has_custom_form IS 'Özel form gerektiriyor mu (Amed Spor gibi etkinlikler için). NULL veya FALSE = normal etkinlikler';
