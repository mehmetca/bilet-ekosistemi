-- events tablosuna organizatör adı alanı (etkinlik sayfasında gösterim için)
-- Bu alan set edilmişse doğrudan kullanılır; yoksa created_by_user_id -> organizer_profiles lookup yapılır
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organizer_display_name TEXT;

COMMENT ON COLUMN public.events.organizer_display_name IS 'Etkinlik sayfasında gösterilecek organizatör/organizasyon adı (örn: Erdal Kaya). Boşsa created_by_user_id üzerinden organizer_profiles''dan alınır.';

-- Mevcut etkinlikler için organizer_profiles'dan backfill (tablo varsa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizer_profiles') THEN
    UPDATE public.events e
    SET organizer_display_name = op.organization_display_name
    FROM public.organizer_profiles op
    WHERE e.created_by_user_id = op.user_id
      AND (e.organizer_display_name IS NULL OR e.organizer_display_name = '');
  END IF;
END $$;
