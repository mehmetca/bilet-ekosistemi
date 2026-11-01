-- 153_organizer_invoice_identity.sql
-- Organizatör = fatura satıcısı kuralının veri tarafı.
--
-- 151'deki satıcı hesabı `organizer_requests`'a bağlıydı ama o tablonun tek satırında bile
-- adres/vergi no yoktu; belge bu yüzden platform adıyla ve SALON adresiyle çıktı. Bu dosya
-- (a) organizatör kaydına Alman Rechnung'un gerektirdiği alanları ekler, (b) etkinliği
-- açıkça bir satıcıya bağlar, (c) issue_order_invoice'u satıcı eksikse faturayı hiç
-- kesmeyecek şekilde değiştirir. KurdEvents adının veya etkinlik/salon adresinin satıcı
-- olarak basılması artık kodda da mümkün değil.
--
-- Bu dosya iki blokte yapıştırılabilir: A = kolonlar, B = fonksiyon.
-- invoices tablosu şu an boş (0 satır) → eski satıcı anlık görüntülerini taşımak gerekmiyor.

-- ===========================================================================
-- BLOK A — veri modeli
-- ===========================================================================

-- § 14 Abs. 4 UStG: "vollständiger Name und Anschrift" + Steuernummer oder USt-IdNr.
-- Anschrift Almanya'da cadde / PLZ / Ort / Land ayrımı ister; tek serbest metin alanı
-- yetmiyor (EN16931 de ayrı element ister).
ALTER TABLE public.organizer_requests
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country_code CHAR(2),
  ADD COLUMN IF NOT EXISTS tax_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_email TEXT,
  ADD COLUMN IF NOT EXISTS logo_path TEXT,
  ADD COLUMN IF NOT EXISTS kleinunternehmer BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizer_requests.street IS
  'Rechnung Anschrift: Strasse + Hausnummer (salon adresi değil, şirketin işyeri adresi).';
COMMENT ON COLUMN public.organizer_requests.postcode IS 'Rechnung Anschrift: Postleitzahl.';
COMMENT ON COLUMN public.organizer_requests.city IS 'Rechnung Anschrift: Ort.';
COMMENT ON COLUMN public.organizer_requests.country_code IS
  'ISO 3166-1 alpha-2 (DE). EN16931 ülke kodu buradan gider.';
COMMENT ON COLUMN public.organizer_requests.tax_number IS
  'Steuernummer (§ 14 Abs. 4 Nr. 4 UStG) — USt-IdNr. yoksa bu zorunlu.';
COMMENT ON COLUMN public.organizer_requests.invoice_email IS
  'Fatura/Rechnung gönderim adresi; hesap e-postasından ayrı olabilir.';
COMMENT ON COLUMN public.organizer_requests.logo_path IS
  'Yerel upload göreli yolu (organizer-logos/...). Belgede satıcı logosu olarak gömülür.';
COMMENT ON COLUMN public.organizer_requests.kleinunternehmer IS
  'true = § 19 UStG: belge vergi göstermez (Kategorie E), oran zorla 0 olur.';

-- Etkinlik, kendisini organize eden organizatör hesabına bağlı olmalı. created_by_user_id
-- seeded etkinliklerde NULL/CLI hesabı; satıcı tayini bu yüzden ayrı kolon.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS seller_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.seller_user_id IS
  'Bu etkinliğin bilet faturasını kesen organizatör hesabı; NULL ise created_by_user_id denenir.';

CREATE INDEX IF NOT EXISTS idx_events_seller_user
  ON public.events(seller_user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';

-- ===========================================================================
-- BLOK B — satıcı çözümlemesi ile yeniden yazılan fatura fonksiyonu
-- ===========================================================================

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
  v_seller_user uuid;
  v_buyer jsonb;
  v_lines jsonb;
  v_missing text[];
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

  SELECT e.id, e.title, e.created_by_user_id, e.seller_user_id,
         e.organizer_display_name, e.date, e.currency, e.vat_rate_percent
    INTO v_event
  FROM public.events e
  WHERE e.id = v_order.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found',
      'message', 'Etkinlik bulunamadı.');
  END IF;

  v_seller_user := coalesce(v_event.seller_user_id, v_event.created_by_user_id);

  -- Satıcı yalnız organizatörün ONAYLI şirket kaydıdır. Etkinlik adresi, salon adresi veya
  -- platform adı satıcı olarak kullanılmaz; eşleşme yoksa belge kesilmez.
  SELECT jsonb_build_object(
    'user_id', v_seller_user,
    'name', nullif(btrim(coalesce(r.company_name, '')), ''),
    'legal_form', nullif(btrim(coalesce(r.legal_form, '')), ''),
    'street', nullif(btrim(coalesce(r.street, '')), ''),
    'postcode', nullif(btrim(coalesce(r.postcode, '')), ''),
    'city', nullif(btrim(coalesce(r.city, '')), ''),
    'country', upper(nullif(btrim(coalesce(r.country_code, '')), '')),
    'email', nullif(btrim(coalesce(r.invoice_email, r.email, '')), ''),
    'phone', nullif(btrim(coalesce(r.phone, '')), ''),
    'vat_id', nullif(upper(replace(btrim(coalesce(r.vat_id, '')), ' ', '')), ''),
    'tax_id', nullif(btrim(coalesce(r.tax_number, '')), ''),
    'register', nullif(btrim(coalesce(r.trade_register_number, '')), ''),
    'register_court', nullif(btrim(coalesce(r.trade_register, '')), ''),
    'representative', nullif(btrim(coalesce(r.representative_name, '')), ''),
    'logo_path', nullif(btrim(coalesce(r.logo_path, '')), ''),
    'kleinunternehmer', coalesce(r.kleinunternehmer, false)
  )
  INTO v_seller
  FROM public.organizer_requests r
  WHERE r.user_id = v_seller_user AND r.status = 'approved';

  IF v_seller IS NULL THEN
    RETURN jsonb_build_object('error', 'seller_incomplete',
      'message', 'Bu etkinliğin organizatör onaylı şirket kaydı yok. Fatura kesilemez; önce organizatör fatura bilgileri doldurulmalı.',
      'missing', jsonb_build_array('organizer_requests'));
  END IF;

  v_missing := ARRAY[]::text[];
  IF v_seller->>'name' IS NULL THEN v_missing := v_missing || 'company_name'; END IF;
  IF v_seller->>'street' IS NULL THEN v_missing := v_missing || 'street'; END IF;
  IF v_seller->>'postcode' IS NULL THEN v_missing := v_missing || 'postcode'; END IF;
  IF v_seller->>'city' IS NULL THEN v_missing := v_missing || 'city'; END IF;
  IF v_seller->>'country' IS NULL THEN v_missing := v_missing || 'country_code'; END IF;
  -- § 14 Abs. 4 Nr. 4: Steuernummer veya USt-IdNr. olmalı; § 19'da hiçbiri gerekmez.
  IF coalesce(v_seller->>'vat_id', '') = ''
     AND coalesce(v_seller->>'tax_id', '') = ''
     AND (v_seller->>'kleinunternehmer') IS DISTINCT FROM 'true' THEN
    v_missing := v_missing || 'vat_id';
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RETURN jsonb_build_object('error', 'seller_incomplete',
      'message', 'Organizatör fatura bilgileri eksik: ' || array_to_string(v_missing, ', '),
      'missing', to_jsonb(v_missing));
  END IF;

  v_buyer := jsonb_build_object(
    'name', coalesce(nullif(btrim(v_order.buyer_name), ''), 'Gast'),
    'email', nullif(v_order.buyer_email, ''),
    'address', nullif(v_order.buyer_address, ''),
    'city', nullif(v_order.buyer_city, ''),
    'user_id', v_order.user_id
  );

  v_rate := coalesce(v_event.vat_rate_percent, 7.00);
  -- § 19 UStG: Kleinunternehmer belge üzerinde vergi gösteremez → oran 0, kategori E.
  IF (v_seller->>'kleinunternehmer') IS DISTINCT FROM 'false' THEN
    v_rate := 0;
  END IF;
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
    (v_number, v_order.id, v_order.event_id, v_seller_user, v_order.user_id,
     now(), coalesce(v_event.currency, 'EUR'), v_gross, v_net, v_tax, v_rate, v_category,
     v_seller, v_buyer, v_lines, v_payment, 'issued', p_actor)
  RETURNING to_jsonb(invoices) INTO v_inv;

  RETURN v_inv || jsonb_build_object('created', true);
END;
$fn$;

COMMENT ON FUNCTION public.issue_order_invoice IS
  'Siparişi organizatörün onaylı şirket kaydıyla Alman Rechnung olarak faturalar; satıcı bilgisi eksikse belge kesmez (seller_incomplete).';

REVOKE ALL ON FUNCTION public.issue_order_invoice(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_order_invoice(uuid, uuid, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
