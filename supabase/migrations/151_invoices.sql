-- 151_invoices.sql
-- Fatura (Rechnung) katmanı: satıcı = organizatör, platform aracılık eder (kullanıcı kararı
-- 2026-10-31), Almanya USt rejimi (%7 kültür / %19 / %0 §19), çıktı PDF + EN16931 XML.
--
-- Neden RPC: numara boşluksuz olmalı (GoBD § "Lückenlosigkeit") ve aynı sipariş ikinci bir
-- fatura üretemez. Numara hesabı + tek satır yazımı bir INSERT içinde atomik kalır.
--
-- Bu dosya iki blokte yapıştırılabilir: A = kolonlar/tablo/RLS, B = fonksiyonlar.

-- ===========================================================================
-- BLOK A — veri modeli
-- ===========================================================================

-- KDV oranı etkinlik başına: 7.00 Kültursteuersatz (Konzert), 19.00 Regelsteuersatz,
-- 0.00 Kleinunternehmer (§ 19 UStG) → belgede "Umsatzsteuer nicht ausgewiesen".
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS vat_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 7.00;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_vat_rate_percent_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_vat_rate_percent_check
  CHECK (vat_rate_percent IN (0.00, 7.00, 19.00));

COMMENT ON COLUMN public.events.vat_rate_percent IS
  'Rechnung KDV oranı (%). 7 konser/kültür, 19 regel, 0 = § 19 UStG Kleinunternehmer.';

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RE-2026-000001; yıl bazında boşluksuz artar, iptal edilen numara geri alınmaz.
  invoice_number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seller_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  currency TEXT NOT NULL DEFAULT 'EUR',
  gross_total NUMERIC(12, 2) NOT NULL CHECK (gross_total >= 0),
  net_total NUMERIC(12, 2) NOT NULL CHECK (net_total >= 0),
  tax_total NUMERIC(12, 2) NOT NULL CHECK (tax_total >= 0),
  tax_rate NUMERIC(5, 2) NOT NULL CHECK (tax_rate >= 0),
  -- EN16931 kategori kodları: S = normal/oran, E = vergiden muaf (§ 19).
  tax_category TEXT NOT NULL DEFAULT 'S' CHECK (tax_category IN ('S', 'E')),
  -- GoBD: belge sonradan değişmemeli → satıcı/alıcı/kalem bilgisi anlık görüntü olarak tutulur.
  -- tickets.price satıştan sonra düzenlenebildiği için birim fiyat siparişten türetilir.
  seller_snapshot JSONB NOT NULL,
  buyer_snapshot JSONB NOT NULL,
  line_items JSONB NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  storno_reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_net_plus_tax CHECK (net_total + tax_total = gross_total)
);

CREATE INDEX IF NOT EXISTS idx_invoices_event ON public.invoices(event_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_seller ON public.invoices(seller_user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer ON public.invoices(buyer_user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_issued ON public.invoices(issued_at DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Yalnızca okuma politikaları: satırları sadece issue_order_invoice/cancel_invoice yazar.
DROP POLICY IF EXISTS "Admin can read all invoices" ON public.invoices;
CREATE POLICY "Admin can read all invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Organizer can read invoices of own events" ON public.invoices;
CREATE POLICY "Organizer can read invoices of own events"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = invoices.event_id AND e.created_by_user_id = auth.uid()
    )
    OR seller_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Buyer can read own invoices" ON public.invoices;
CREATE POLICY "Buyer can read own invoices"
  ON public.invoices FOR SELECT
  USING (buyer_user_id = auth.uid());

-- ===========================================================================
-- BLOK B — fonksiyonlar
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- issue_order_invoice: siparişi faturala (idempotent)
-- ---------------------------------------------------------------------------
-- Aynı sipariş için ikinci çağrı mevcut satırı döner; numara yakılmaz.
-- Aritmetik: USt = round(brüt * oran / (100 + oran), 2), net = brüt - USt → toplam
-- ödenen tutarla birebir eşittir. Satır adedi, net/adet tam bölmezse 1'e indirilir
-- (EN16931 satır aritmetiği: qty * unit = line net).
CREATE OR REPLACE FUNCTION public.issue_order_invoice(
  p_order_id uuid,
  p_actor uuid DEFAULT NULL,
  p_allowed_event_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order record;
  v_event record;
  v_existing jsonb;
  v_seller jsonb;
  v_buyer jsonb;
  v_lines jsonb;
  v_rate numeric;
  v_category text;
  v_gross numeric;
  v_tax numeric;
  v_net numeric;
  v_qty integer;
  v_unit numeric;
  v_number text;
  v_payment text;
  v_inv jsonb;
BEGIN
  SELECT o.id, o.event_id, o.user_id, o.buyer_name, o.buyer_email, o.buyer_address,
         o.buyer_city, o.quantity, o.total_price, o.status, o.sales_channel,
         o.door_payment, o.created_at
    INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found',
      'message', 'Sipariş bulunamadı.');
  END IF;

  -- orders.status ENUM'dur ('confirmed' YOK) → text'e çevirerek karşılaştır.
  IF v_order.status::text <> 'completed' THEN
    RETURN jsonb_build_object('error', 'not_paid',
      'message', 'Yalnız tamamlanmış sipariş için fatura düzenlenir.');
  END IF;

  IF p_allowed_event_ids IS NOT NULL
     AND NOT coalesce(v_order.event_id = ANY(p_allowed_event_ids), false) THEN
    RETURN jsonb_build_object('error', 'forbidden',
      'message', 'Bu sipariş için fatura yetkin yok.');
  END IF;

  SELECT to_jsonb(i) INTO v_existing
  FROM public.invoices i
  WHERE i.order_id = p_order_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing || jsonb_build_object('created', false);
  END IF;

  SELECT e.id, e.title, e.created_by_user_id, e.organizer_display_name, e.address,
         e.city, e.location, e.date, e.currency, e.vat_rate_percent
    INTO v_event
  FROM public.events e
  WHERE e.id = v_order.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found',
      'message', 'Etkinlik bulunamadı.');
  END IF;

  SELECT jsonb_build_object(
    'name', coalesce(
      nullif(r.company_name, ''),
      nullif(e.organizer_display_name, ''),
      nullif(op.organization_display_name, ''),
      nullif(concat_ws(' ', up.first_name, up.last_name), ''),
      'KurdEvents'),
    'legal_form', nullif(r.legal_form, ''),
    'address', coalesce(nullif(r.address, ''), nullif(e.address, ''), ''),
    'city', coalesce(nullif(e.city, ''), ''),
    'email', coalesce(nullif(r.email, ''), au.email),
    'phone', nullif(r.phone, ''),
    'vat_id', nullif(r.vat_id, ''),
    'tax_id', nullif(r.extra_data ->> 'steuernummer', ''),
    'register', nullif(r.trade_register_number, '')
  )
  INTO v_seller
  FROM public.events e
  LEFT JOIN public.organizer_requests r
    ON r.user_id = e.created_by_user_id AND r.status = 'approved'
  LEFT JOIN public.organizer_profiles op ON op.user_id = e.created_by_user_id
  LEFT JOIN public.user_profiles up ON up.user_id = e.created_by_user_id
  LEFT JOIN auth.users au ON au.id = e.created_by_user_id
  WHERE e.id = v_order.event_id;

  v_buyer := jsonb_build_object(
    'name', coalesce(nullif(btrim(v_order.buyer_name), ''), 'Gast'),
    'email', nullif(v_order.buyer_email, ''),
    'address', nullif(v_order.buyer_address, ''),
    'city', nullif(v_order.buyer_city, ''),
    'user_id', v_order.user_id
  );

  v_rate := coalesce(v_event.vat_rate_percent, 7.00);
  v_category := CASE WHEN v_rate = 0 THEN 'E' ELSE 'S' END;
  v_gross := round(coalesce(v_order.total_price, 0), 2);
  v_tax := CASE WHEN v_rate = 0 THEN 0
                ELSE round(v_gross * v_rate / (100 + v_rate), 2) END;
  v_net := v_gross - v_tax;
  v_qty := coalesce(nullif(v_order.quantity, 0), 1);

  v_unit := round(v_net / v_qty, 2);
  IF v_unit * v_qty <> v_net THEN
    v_qty := 1;
    v_unit := v_net;
  END IF;

  v_lines := jsonb_build_array(jsonb_build_object(
    'text', coalesce(nullif(v_event.title, ''), 'Eintrittskarte') || ' – Einlasskarte'
      || CASE WHEN v_event.date IS NOT NULL
              THEN ' am ' || to_char(v_event.date, 'DD.MM.YYYY')
              ELSE '' END,
    'qty', v_qty,
    'unit_net', v_unit,
    'line_net', v_net,
    'line_tax', v_tax,
    'line_gross', v_gross,
    'tax_rate', v_rate,
    'tax_category', v_category
  ));

  v_payment := CASE
    WHEN v_order.sales_channel = 'door' AND v_order.door_payment = 'cash' THEN 'Barzahlung'
    WHEN v_order.sales_channel = 'door' THEN 'Kartenzahlung (Kasse)'
    ELSE 'Kreditkarte / Stripe'
  END;

  -- Numara boşluğu: iptal edilen fatura numarasını korur, eşzamanlı iki kesim aynı
  -- numarayı üretmesin diye transaction kilidi alınır.
  PERFORM pg_advisory_xact_lock(hashtext('kurdevents_invoice_number'));

  SELECT 'RE-' || to_char(now(), 'YYYY') || '-' ||
         lpad((count(*) + 1)::text, 6, '0')
    INTO v_number
  FROM public.invoices
  WHERE to_char(issued_at, 'YYYY') = to_char(now(), 'YYYY');

  INSERT INTO public.invoices
    (invoice_number, order_id, event_id, seller_user_id, buyer_user_id,
     issued_at, currency, gross_total, net_total, tax_total, tax_rate, tax_category,
     seller_snapshot, buyer_snapshot, line_items, payment_method, status, created_by)
  VALUES
    (v_number, v_order.id, v_order.event_id, v_event.created_by_user_id, v_order.user_id,
     now(), coalesce(v_event.currency, 'EUR'), v_gross, v_net, v_tax, v_rate, v_category,
     v_seller, v_buyer, v_lines, v_payment, 'issued', p_actor)
  RETURNING to_jsonb(invoices) INTO v_inv;

  RETURN v_inv || jsonb_build_object('created', true);
END;
$fn$;

COMMENT ON FUNCTION public.issue_order_invoice IS
  'Siparişi organizatör satıcılı Alman Rechnung olarak faturalar: boşluksuz numara, satıcı/alıcı anlık görüntüsü, brüt->net/USt ayrıştırması, idempotent.';

-- ---------------------------------------------------------------------------
-- cancel_invoice: Storno (numara geri alınmaz, satır "cancelled" olarak kalır)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_invoice(
  p_invoice_id uuid,
  p_reason text DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_allowed_event_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_event uuid;
  v_status text;
BEGIN
  SELECT i.event_id, i.status INTO v_event, v_status
  FROM public.invoices i
  WHERE i.id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'Fatura bulunamadı.');
  END IF;

  IF p_allowed_event_ids IS NOT NULL
     AND NOT coalesce(v_event = ANY(p_allowed_event_ids), false) THEN
    RETURN jsonb_build_object('error', 'forbidden',
      'message', 'Bu fatura için yetkin yok.');
  END IF;

  IF v_status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'already_cancelled',
      'message', 'Bu fatura zaten iptal edilmiş.');
  END IF;

  UPDATE public.invoices
     SET status = 'cancelled',
         storno_reason = nullif(btrim(coalesce(p_reason, '')), '')
   WHERE id = p_invoice_id;

  RETURN (SELECT to_jsonb(i) || jsonb_build_object('cancelled', true)
          FROM public.invoices i WHERE i.id = p_invoice_id);
END;
$fn$;

COMMENT ON FUNCTION public.cancel_invoice IS
  'Faturayı Storno olarak işaretler; numara ve satır silinmez (GoBD).';

REVOKE ALL ON FUNCTION public.issue_order_invoice(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_order_invoice(uuid, uuid, uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_invoice(uuid, text, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice(uuid, text, uuid, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
