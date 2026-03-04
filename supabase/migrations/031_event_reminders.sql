-- Bilet uyarısı: Kullanıcılar etkinlik öncesi hatırlatma maili almak için e-posta kaydedebilir
CREATE TABLE IF NOT EXISTS public.event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  reminder_sent_at timestamptz,
  UNIQUE(event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id ON public.event_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_reminder_sent ON public.event_reminders(reminder_sent_at) WHERE reminder_sent_at IS NULL;

-- Herkes kayıt yapabilir (anon)
ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_reminders_insert" ON public.event_reminders;
CREATE POLICY "event_reminders_insert" ON public.event_reminders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "event_reminders_select" ON public.event_reminders;
CREATE POLICY "event_reminders_select" ON public.event_reminders
  FOR SELECT USING (true);

-- Cron/servis hatırlatma göndermek için service role kullanacak (RLS bypass)
