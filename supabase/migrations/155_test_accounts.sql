-- 155: Test hesapları — deneme siparişleri resmî fatura defterine hiç girmesin.
-- Gerekçe: fatura numarası count(*)+1'den üretiliyor; test siparişine kesilen belge
-- resmî RE numarasını yakıyor ve ciro/kasa toplamlarını kirletiyor.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.is_test IS
  'Sipariş sahibinin veya alıcının e-postası test_accounts''ta ise INSERT anında true olur; resmî belge üretmez.';

CREATE TABLE IF NOT EXISTS public.test_accounts (
  email TEXT PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.test_accounts ENABLE ROW LEVEL SECURITY;

-- Bilerek politika yok: listeye yalnız postgres süper kullanıcısı (SSH/psql) ve SECURITY
-- DEFINER fonksiyonlar erişir. Yönetim de aynı yoldan yapılır.

INSERT INTO public.test_accounts (email, note)
VALUES (lower('cantoprak21@gmail.com'), 'Kullanıcının kendi deneme hesabı')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.orders_mark_test()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_owner_email text;
BEGIN
  SELECT lower(u.email) INTO v_owner_email FROM auth.users u WHERE u.id = NEW.user_id;

  NEW.is_test :=
    coalesce(lower(btrim(NEW.buyer_email)), '') IN (SELECT lower(email) FROM public.test_accounts)
    OR coalesce(v_owner_email, '') IN (SELECT lower(email) FROM public.test_accounts);

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_orders_mark_test ON public.orders;
CREATE TRIGGER trg_orders_mark_test
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_mark_test();

-- Aynı kalıptaki eski siparişleri de işaretle.
UPDATE public.orders o
SET is_test = true
WHERE o.is_test = false
  AND (
    coalesce(lower(btrim(o.buyer_email)), '') IN (SELECT lower(email) FROM public.test_accounts)
    OR coalesce((SELECT lower(u.email) FROM auth.users u WHERE u.id = o.user_id), '')
       IN (SELECT lower(email) FROM public.test_accounts)
  );

NOTIFY pgrst, 'reload schema';

-- ===========================================================================
-- BLOK B — sert garanti: `issue_order_invoice` dokunulmadan, test siparişinin
-- belge satırı INSERT edilemez (panel düğmesi doğrudan RPC'yi çağırsa bile).
-- Uygulama tarafı (`issueInvoiceForOrder`) is_test'i önceden okuyup yumuşak
-- hata verdiği için bu istisna yalnızca o kapı atlanırsa devreye girer.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.invoices_block_test()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = NEW.order_id AND o.is_test
  ) THEN
    RAISE EXCEPTION 'TEST_SIPARIS: deneme siparişi için resmî fatura düzenlenmez'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_invoices_block_test ON public.invoices;
CREATE TRIGGER trg_invoices_block_test
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_block_test();

NOTIFY pgrst, 'reload schema';
