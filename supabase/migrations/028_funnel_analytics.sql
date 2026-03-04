-- Huni analitiği: görüntüleme -> ödeme başlatma -> satın alma
-- event_views: etkinlik sayfası görüntüleme
CREATE TABLE IF NOT EXISTS public.event_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_id text,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_views_event_id ON public.event_views(event_id);
CREATE INDEX IF NOT EXISTS idx_event_views_viewed_at ON public.event_views(viewed_at);

-- purchase_intents: kullanıcı ödeme formunu gönderdi (başarılı/başarısız fark etmez)
CREATE TABLE IF NOT EXISTS public.purchase_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  session_id text,
  intent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_purchase_intents_event_id ON public.purchase_intents(event_id);
CREATE INDEX IF NOT EXISTS idx_purchase_intents_intent_at ON public.purchase_intents(intent_at);

-- RLS: Herkes (anon dahil) event_views ve purchase_intents insert yapabilir
ALTER TABLE public.event_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert event_views" ON public.event_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert purchase_intents" ON public.purchase_intents
  FOR INSERT WITH CHECK (true);

-- Sadece admin/controller select yapabilir
CREATE POLICY "Admins can select event_views" ON public.event_views
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

CREATE POLICY "Admins can select purchase_intents" ON public.purchase_intents
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );
