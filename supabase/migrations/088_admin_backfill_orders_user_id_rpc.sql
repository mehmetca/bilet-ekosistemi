-- Tek tıkla (admin API) veya service_role ile: user_id boş ama buyer_email auth.users ile eşleşen siparişleri hesaba bağlar
-- Yönetim → Siparişler: "Siparişleri hesaplara bağla" düğmesi bu fonksiyonu çağırır (POST /api/admin/backfill-orders-user-id)

CREATE OR REPLACE FUNCTION public.admin_backfill_orders_user_id()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.orders o
  SET user_id = u.id
  FROM auth.users u
  WHERE o.user_id IS NULL
    AND o.buyer_email IS NOT NULL
    AND TRIM(o.buyer_email) <> ''
    AND LOWER(TRIM(o.buyer_email)) = LOWER(TRIM(u.email));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_backfill_orders_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_backfill_orders_user_id() TO service_role;
