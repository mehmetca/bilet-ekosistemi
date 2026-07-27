-- Checkout fulfillment atomik claim, sipariş tekillik, soft-cancel kısıtları

-- 1) Intent durumları: processing (claim), refunded (ödeme iade edildi)
ALTER TABLE public.stripe_checkout_intents
  DROP CONSTRAINT IF EXISTS stripe_checkout_intents_status_check;

ALTER TABLE public.stripe_checkout_intents
  ADD CONSTRAINT stripe_checkout_intents_status_check
  CHECK (status IN ('pending', 'paid', 'processing', 'fulfilled', 'failed', 'refunded'));

-- 2) Atomik fulfillment claim (webhook / ensure-fulfillment yarışını keser)
CREATE OR REPLACE FUNCTION public.claim_checkout_intent(p_stripe_session_id text)
RETURNS SETOF public.stripe_checkout_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.stripe_checkout_intents
  SET
    status = 'processing',
    updated_at = now()
  WHERE stripe_session_id = p_stripe_session_id
    AND (
      status IN ('pending', 'paid')
      OR (
        status = 'processing'
        AND updated_at < now() - interval '2 minutes'
      )
    )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_checkout_intent(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_checkout_intent(text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_checkout_intent(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_checkout_intent(text) TO service_role;

COMMENT ON FUNCTION public.claim_checkout_intent(text) IS
  'Fulfillment için intent claim. Stuck processing (>2dk) yeniden alınabilir.';

-- 3) Sipariş iptali: stok geri + order_seats / units sil (koltuk unique serbest kalsın)
CREATE OR REPLACE FUNCTION public.cancel_order_release_inventory(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, ticket_id, quantity, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sipariş bulunamadı');
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true);
  END IF;

  IF v_order.ticket_id IS NOT NULL AND v_order.quantity > 0 THEN
    UPDATE public.tickets t
    SET available = LEAST(
      COALESCE(t.quantity, 0),
      COALESCE(t.available, 0) + v_order.quantity
    )
    WHERE t.id = v_order.ticket_id;
  END IF;

  DELETE FROM public.order_seats WHERE order_id = p_order_id;
  DELETE FROM public.order_ticket_units WHERE order_id = p_order_id;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_release_inventory(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_order_release_inventory(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_order_release_inventory(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_release_inventory(uuid) TO service_role;

-- 4) Aynı Stripe oturumu + bilet için tek tamamlanmış sipariş
-- Önce varsa eski çiftleri soft-cancel et (unique index kurulabilsin)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY stripe_session_id, ticket_id
          ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
      FROM public.orders
      WHERE stripe_session_id IS NOT NULL
        AND status = 'completed'
    ) d
    WHERE rn > 1
  LOOP
    PERFORM public.cancel_order_release_inventory(r.id);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_ticket_completed_unique
  ON public.orders (stripe_session_id, ticket_id)
  WHERE stripe_session_id IS NOT NULL AND status = 'completed';

-- 5) Kullanıcı sipariş silme → soft-cancel; check-in / yakın etkinlik engeli; completed+ödendi için kapalı
CREATE OR REPLACE FUNCTION public.delete_my_order(
  p_order_id uuid,
  p_user_id uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_is_owner boolean := false;
  v_checked boolean := false;
  v_event_at timestamptz;
BEGIN
  SELECT
    o.id,
    o.user_id,
    o.buyer_email,
    o.ticket_id,
    o.quantity,
    o.status,
    o.checked_at,
    o.stripe_session_id,
    o.stripe_payment_intent_id,
    e.date AS event_date,
    e.time AS event_time
  INTO v_order
  FROM public.orders o
  LEFT JOIN public.events e ON e.id = o.event_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sipariş bulunamadı');
  END IF;

  IF v_order.user_id = p_user_id THEN
    v_is_owner := true;
  ELSIF p_email IS NOT NULL AND p_email != '' AND v_order.buyer_email IS NOT NULL
    AND LOWER(TRIM(v_order.buyer_email)) = LOWER(TRIM(p_email)) THEN
    v_is_owner := true;
  END IF;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu siparişe erişim yetkiniz yok');
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true);
  END IF;

  -- Ödenmiş tamamlanmış siparişler self-service ile silinemez / iptal edilemez
  IF v_order.status = 'completed'
     AND (
       v_order.stripe_session_id IS NOT NULL
       OR v_order.stripe_payment_intent_id IS NOT NULL
     ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ödenmiş siparişler silinemez. İade için destek ile iletişime geçin.'
    );
  END IF;

  IF v_order.checked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Giriş yapılmış sipariş iptal edilemez');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.order_seats os
    WHERE os.order_id = p_order_id AND os.checked_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.order_ticket_units otu
    WHERE otu.order_id = p_order_id AND otu.checked_at IS NOT NULL
  ) INTO v_checked;

  IF v_checked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Giriş yapılmış sipariş iptal edilemez');
  END IF;

  IF v_order.event_date IS NOT NULL THEN
    v_event_at := (
      (v_order.event_date::text || ' ' || COALESCE(NULLIF(TRIM(v_order.event_time::text), ''), '23:59'))
    )::timestamptz;
    IF v_event_at <= now() + interval '24 hours' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Etkinliğe 24 saatten az kaldığı için sipariş iptal edilemez'
      );
    END IF;
  END IF;

  PERFORM public.cancel_order_release_inventory(p_order_id);

  RETURN jsonb_build_object('success', true, 'cancelled', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_order(uuid, uuid, text) TO service_role;
