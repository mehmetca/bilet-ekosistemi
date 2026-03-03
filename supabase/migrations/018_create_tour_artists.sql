-- Turneler ve Sanatcilar alanlarini tamamen ayirmak icin
-- Turneler artik artists yerine tour_artists tablosunu kullanir.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tour_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  tour_name text,
  image_url text,
  bio text,
  price_from numeric,
  tour_start_date timestamptz,
  tour_end_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Mevcut turne kayitlarini korumak icin: tour_events ile iliskili sanatcilari kopyala.
INSERT INTO public.tour_artists (
  id, name, slug, tour_name, image_url, bio, price_from, tour_start_date, tour_end_date, created_at, updated_at
)
SELECT DISTINCT
  a.id,
  a.name,
  a.slug,
  a.tour_name,
  a.image_url,
  a.bio,
  a.price_from,
  a.tour_start_date,
  a.tour_end_date,
  COALESCE(a.created_at, now()),
  now()
FROM public.artists a
INNER JOIN public.tour_events te ON te.artist_id = a.id
ON CONFLICT (id) DO NOTHING;

-- tour_events.artist_id icin varsa eski FK'yi dusur.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name
    INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'tour_events'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'artist_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.tour_events DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- tour_events artist_id artik tour_artists'e bagli olsun.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'tour_events'
      AND constraint_name = 'tour_events_artist_id_fkey'
  ) THEN
    ALTER TABLE public.tour_events
      ADD CONSTRAINT tour_events_artist_id_fkey
      FOREIGN KEY (artist_id)
      REFERENCES public.tour_artists(id)
      ON DELETE CASCADE;
  END IF;
END $$;
