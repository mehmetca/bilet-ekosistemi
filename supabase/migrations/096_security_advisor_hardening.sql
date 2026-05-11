-- Supabase Database Advisor: search_path, permissive RLS, SECURITY DEFINER RPC yüzeyi.
-- Storage bucket listing ve Auth leaked-password uyarıları Dashboard ile ele alınır.

-- ---------------------------------------------------------------------------
-- 1) search_path (lint 0011_function_search_path_mutable)
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.hold_seat(uuid, uuid, uuid, text, integer) SET search_path = public;
ALTER FUNCTION public.release_seat_hold(uuid, uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.generate_order_number() SET search_path = public;
ALTER FUNCTION public.set_order_number() SET search_path = public;
ALTER FUNCTION public.reserve_ticket_stock(uuid, integer) SET search_path = public;
ALTER FUNCTION public.release_ticket_stock(uuid, integer) SET search_path = public;

-- ---------------------------------------------------------------------------
-- 2) RLS: INSERT/DELETE için WITH CHECK / USING (true) kaldırıldı (lint 0024)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can insert artist_follows" ON public.artist_follows;
CREATE POLICY "Anyone can insert artist_follows" ON public.artist_follows
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (
      auth.uid() IS NULL
      AND user_id IS NULL
      AND session_id IS NOT NULL
      AND length(trim(session_id)) > 0
    )
  );

DROP POLICY IF EXISTS "Anyone can delete own artist_follows" ON public.artist_follows;
CREATE POLICY "Anyone can delete own artist_follows" ON public.artist_follows
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Anyone can insert event_favorites" ON public.event_favorites;
CREATE POLICY "Anyone can insert event_favorites" ON public.event_favorites
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (
      auth.uid() IS NULL
      AND user_id IS NULL
      AND session_id IS NOT NULL
      AND length(trim(session_id)) > 0
    )
  );

DROP POLICY IF EXISTS "Anyone can delete event_favorites" ON public.event_favorites;
CREATE POLICY "Anyone can delete event_favorites" ON public.event_favorites
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "event_reminders_insert" ON public.event_reminders;
CREATE POLICY "event_reminders_insert" ON public.event_reminders
  FOR INSERT WITH CHECK (
    length(trim(email)) > 0
    AND position('@' IN email) > 1
    AND event_id IS NOT NULL
  );

DROP POLICY IF EXISTS "Anyone can insert event_views" ON public.event_views;
CREATE POLICY "Anyone can insert event_views" ON public.event_views
  FOR INSERT WITH CHECK (event_id IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can insert purchase_intents" ON public.purchase_intents;
CREATE POLICY "Anyone can insert purchase_intents" ON public.purchase_intents
  FOR INSERT WITH CHECK (event_id IS NOT NULL AND intent_at IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 3) RPC EXECUTE: prod API route'ları service_role kullanıyor (lint 0028 / 0029)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.reserve_tickets_and_create_order(uuid, integer, numeric, text, text, text, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_tickets_and_create_order(uuid, integer, numeric, text, text, text, uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_tickets_and_create_order(uuid, integer, numeric, text, text, text, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tickets_and_create_order(uuid, integer, numeric, text, text, text, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.delete_my_order(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_order(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.delete_my_order(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_order(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_user_orders(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_orders(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_orders(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_orders(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_backfill_orders_user_id() FROM anon;
REVOKE ALL ON FUNCTION public.admin_backfill_orders_user_id() FROM authenticated;

REVOKE ALL ON FUNCTION public.create_theater_duisburg_plan(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_theater_duisburg_plan(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.create_theater_duisburg_plan(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_theater_duisburg_plan(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_ticket_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_ticket_stock(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_ticket_stock(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ticket_stock(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.release_ticket_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_ticket_stock(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.release_ticket_stock(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_ticket_stock(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.hold_seat(uuid, uuid, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hold_seat(uuid, uuid, uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.hold_seat(uuid, uuid, uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hold_seat(uuid, uuid, uuid, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.release_seat_hold(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_seat_hold(uuid, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.release_seat_hold(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_seat_hold(uuid, uuid, uuid, text) TO service_role;

-- Not: get_user_role / is_admin / is_controller / rls_auto_enable elle eklenmiş ortamlarda varsa,
-- Supabase SQL Editor'da aynı REVOKE/GRANT kalıbını uygulayın (migration zincirinde tanımlı değiller).

-- Tetikleyici yardımcıları: anon kapalı; authenticated tablo yazımı için kalır
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
