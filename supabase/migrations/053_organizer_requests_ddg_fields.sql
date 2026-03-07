-- organizer_requests tablosuna DDG § 5 ve sözleşme bilgileri için alanlar ekle
-- Digitale-Dienste-Gesetz § 5 uyarınca organizatörlerin sağlaması gereken bilgiler

ALTER TABLE public.organizer_requests
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_form TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS trade_register TEXT,
  ADD COLUMN IF NOT EXISTS trade_register_number TEXT,
  ADD COLUMN IF NOT EXISTS vat_id TEXT,
  ADD COLUMN IF NOT EXISTS representative_name TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.organizer_requests.company_name IS 'DDG § 5: Firma/Unternehmen adı';
COMMENT ON COLUMN public.organizer_requests.legal_form IS 'DDG § 5: Rechtsform (GmbH, AG, Einzelunternehmen vb.)';
COMMENT ON COLUMN public.organizer_requests.address IS 'DDG § 5: Ladungsfähige Anschrift';
COMMENT ON COLUMN public.organizer_requests.phone IS 'DDG § 5: Telefon numarası';
COMMENT ON COLUMN public.organizer_requests.trade_register IS 'DDG § 5: Handelsregister / Registergericht';
COMMENT ON COLUMN public.organizer_requests.trade_register_number IS 'DDG § 5: Registernummer';
COMMENT ON COLUMN public.organizer_requests.vat_id IS 'DDG § 5: USt-IdNr. veya WiIdNr.';
COMMENT ON COLUMN public.organizer_requests.representative_name IS 'DDG § 5: Vertretungsberechtigter';
COMMENT ON COLUMN public.organizer_requests.terms_accepted_at IS 'Sözleşme ve kuralların kabul edildiği tarih';
