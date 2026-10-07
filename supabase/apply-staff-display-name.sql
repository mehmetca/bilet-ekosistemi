-- 122_ticket_check_logs.sql içindeki tanımla AYNI kısa sürüm.
-- Dashboard'a uzun dosya yapıştırılırken kuyruk kırpılıyor: bu dosya bilerek küçük,
-- statement'lar bloklara ayrılıp tek tek çalıştırılabilir.
--
-- Blok A
CREATE OR REPLACE FUNCTION public.staff_display_name(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    nullif(concat_ws(' ',
      (select first_name from user_profiles where user_id = p_user_id),
      (select last_name  from user_profiles where user_id = p_user_id)), ''),
    (select email from auth.users where id = p_user_id),
    'Görevli ' || left(p_user_id::text, 8));
$$;
-- blok-a-bitti

-- Blok B
REVOKE ALL ON FUNCTION public.staff_display_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_display_name(uuid) TO service_role;
notify pgrst, 'reload schema';
-- blok-b-bitti

-- Blok C (canlıdaki admin hesabıyla doğrulama)
select public.staff_display_name('bb09410b-b256-4193-901d-8860ac4b599f') as ad;
-- blok-c-bitti
