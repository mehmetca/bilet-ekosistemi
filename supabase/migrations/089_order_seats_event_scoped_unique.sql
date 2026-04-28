-- Aynı salon farklı etkinlik/seanslarda tekrar kullanılabilsin:
-- seat satış tekilliği global seat_id yerine (event_id, seat_id) bazında olmalıdır.

ALTER TABLE public.order_seats
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

-- Geçmiş kayıtlar için event_id'yi siparişten doldur.
UPDATE public.order_seats os
SET event_id = o.event_id
FROM public.orders o
WHERE o.id = os.order_id
  AND os.event_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_seats_event ON public.order_seats(event_id);

-- Eski global seat_id tekilliğini kaldır (farklı etkinliklerde aynı seat_id satılabilsin).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = ck.attnum
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'order_seats'
      AND con.contype = 'u'
    GROUP BY con.conname
    HAVING COUNT(*) = 1 AND MIN(a.attname) = 'seat_id'
  LOOP
    EXECUTE format('ALTER TABLE public.order_seats DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT i.relname AS index_name
    FROM pg_index idx
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_namespace nsp ON nsp.oid = t.relnamespace
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE nsp.nspname = 'public'
      AND t.relname = 'order_seats'
      AND idx.indisunique = true
      AND idx.indisprimary = false
    GROUP BY i.relname
    HAVING COUNT(*) = 1 AND MIN(a.attname) = 'seat_id'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.index_name);
  END LOOP;
END $$;

-- Yeni tekillik: aynı etkinlikte aynı koltuk bir kez satılabilir.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_seats_event_seat_unique
  ON public.order_seats(event_id, seat_id)
  WHERE event_id IS NOT NULL;
