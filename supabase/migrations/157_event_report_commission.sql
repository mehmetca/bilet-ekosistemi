-- 157_event_report_commission.sql
-- Etkinlik mutabakat raporundaki komisyon oranı.
--
-- Oran etkinlik başına elle girilir (sanatçı/organizatör anlaşması değişebilir).
-- NULL = komisyon yok: kendi etkinliklerimizde (White de Soul) satır hiç basılmaz.
-- Hesaplama rapor üretilirken yapılır; burada yalnız oran saklanır.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS commission_rate_percent NUMERIC(5, 2);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_commission_rate_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_commission_rate_check
  CHECK (
    commission_rate_percent IS NULL
    OR (commission_rate_percent >= 0 AND commission_rate_percent <= 100)
  );

COMMENT ON COLUMN public.events.commission_rate_percent IS
  'Etkinlik raporundaki platform komisyonu (%). NULL = komisyon yok (kendi etkinliğimiz).';

-- PostgREST yeni kolonu görebilsin (self-host'da şart).
notify pgrst, 'reload schema';
