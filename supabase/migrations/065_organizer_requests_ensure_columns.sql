-- organizer_requests tablosunda API'nin beklediği sütunların hepsinin var olduğundan emin ol
-- (053 / 054 çalışmamış ortamlarda "company_name does not exist" hatasını giderir)

ALTER TABLE public.organizer_requests
  ADD COLUMN IF NOT EXISTS organization_display_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS representative_name TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS trade_register TEXT,
  ADD COLUMN IF NOT EXISTS trade_register_number TEXT,
  ADD COLUMN IF NOT EXISTS vat_id TEXT,
  ADD COLUMN IF NOT EXISTS legal_form TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb;
