-- Eksik performans index'leri
-- tickets(event_id) ve orders(user_id) zaten 056 ve 039'da mevcut.
-- Eklenenler: orders(ticket_id), events(created_by_user_id), events(is_approved)

-- orders.ticket_id: sipariş-bilet eşlemesi, raporlar, join'ler
CREATE INDEX IF NOT EXISTS idx_orders_ticket_id ON public.orders (ticket_id);

-- events.created_by_user_id: organizatör kendi etkinlikleri, RLS "Organizer can view own events"
CREATE INDEX IF NOT EXISTS idx_events_created_by_user_id ON public.events (created_by_user_id);

-- events.is_approved: RLS "Public read approved events", liste filtreleri
CREATE INDEX IF NOT EXISTS idx_events_is_approved ON public.events (is_approved) WHERE is_approved = true;
