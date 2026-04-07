-- Müşteri kendi siparişini silebilsin (user_id veya buyer_email eşleşmesi)

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
  v_deleted boolean := false;
BEGIN
  SELECT id, user_id, buyer_email, ticket_id, quantity
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sipariş bulunamadı');
  END IF;

  -- Sahiplik kontrolü
  IF v_order.user_id = p_user_id THEN
    v_deleted := true;
  ELSIF p_email IS NOT NULL AND p_email != '' AND v_order.buyer_email IS NOT NULL
    AND LOWER(TRIM(v_order.buyer_email)) = LOWER(TRIM(p_email)) THEN
    v_deleted := true;
  END IF;

  IF NOT v_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu siparişe erişim yetkiniz yok');
  END IF;

  -- Stok geri ekle
  IF v_order.ticket_id IS NOT NULL AND v_order.quantity > 0 THEN
    UPDATE public.tickets t
    SET available = LEAST(
      COALESCE(t.quantity, 0),
      COALESCE(t.available, 0) + v_order.quantity
    )
    WHERE t.id = v_order.ticket_id;
  END IF;

  -- Önce order_seats kayıtlarını sil (RLS cascade sorununu önlemek için)
  DELETE FROM public.order_seats WHERE order_id = p_order_id;

  -- Siparişi sil
  DELETE FROM public.orders WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_order(uuid, uuid, text) TO service_role;
