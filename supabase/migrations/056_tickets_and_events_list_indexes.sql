-- Performance: En çok sorgulanan kolonlara index
-- tickets: event_id (etkinlik detay, satın alma, yönetim)
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON public.tickets (event_id);

-- events listesi: is_active + created_at (ana sayfa, liste sorguları)
CREATE INDEX IF NOT EXISTS idx_events_is_active_created_at ON public.events (is_active, created_at DESC) WHERE is_active = true;

-- events: date + time (takvim, şehir sayfası sıralama)
CREATE INDEX IF NOT EXISTS idx_events_date_time ON public.events (date, time) WHERE is_active = true;
