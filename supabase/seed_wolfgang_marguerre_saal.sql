-- Wolfgang-Marguerre-Saal (Konzerthaus Stadthalle Heidelberg) oturum planı – Eventim ile aynı yapı, örnek olarak.
-- Parkett Block A/B/C, Empore links / Mitte / rechts; sıra ve koltuk sayıları gerçekçi (~960 koltuk).
-- Ön koşul: Migration 070 (seating_plans, sections, rows, seats) ve 071 (ticket_type_label) uygulanmış olmalı.
-- Çalıştırma: Supabase Dashboard → SQL Editor → bu dosyanın içeriğini yapıştırıp Run.

-- 1) Mekan (venue) – idempotent
INSERT INTO public.venues (id, name, city, address, capacity)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Konzerthaus Stadthalle Heidelberg',
  'Heidelberg',
  'Neckarstaden 24, 69117 Heidelberg',
  987
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  address = EXCLUDED.address,
  capacity = EXCLUDED.capacity;

-- 2) Eski planı sil (varsa) ve yeni plan ekle
DELETE FROM public.seating_plans
WHERE id = '22222222-2222-4222-8222-222222222222';

INSERT INTO public.seating_plans (id, venue_id, name, is_default)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Wolfgang-Marguerre-Saal',
  true
);

-- 3) Bölümler (sections) – Eventim tarzı: Parkett A/B/C, Empore links/Mitte/rechts
INSERT INTO public.seating_plan_sections (id, seating_plan_id, name, sort_order, ticket_type_label)
VALUES
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222222', 'Parkett Block A', 1, 'Kategori 1'),
  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222222', 'Parkett Block B', 2, 'Kategori 1'),
  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222222', 'Parkett Block C', 3, 'Kategori 1'),
  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222222', 'Empore links', 4, 'Kategori 2'),
  ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222222', 'Empore Mitte', 5, 'Kategori 2'),
  ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222222', 'Empore rechts', 6, 'Kategori 2');

-- 4) Sıralar ve koltuklar – PL/pgSQL ile
DO $$
DECLARE
  sec RECORD;
  r_id UUID;
  row_num INT;
  seat_num INT;
  n_rows INT;
  n_seats INT;
  section_config RECORD;
BEGIN
  -- (section_id, section_key, n_rows, seats_per_row)
  FOR section_config IN
    SELECT sid AS section_id, n_r AS n_rows, n_s AS n_seats
    FROM (VALUES
      ('33333333-3333-4333-8333-333333333301'::UUID, 12, 18),
      ('33333333-3333-4333-8333-333333333302'::UUID, 12, 24),
      ('33333333-3333-4333-8333-333333333303'::UUID, 12, 18),
      ('33333333-3333-4333-8333-333333333304'::UUID, 5, 12),
      ('33333333-3333-4333-8333-333333333305'::UUID, 6, 20),
      ('33333333-3333-4333-8333-333333333306'::UUID, 5, 12)
    ) AS t(sid, n_r, n_s)
  LOOP
    FOR row_num IN 1..section_config.n_rows LOOP
      INSERT INTO public.seating_plan_rows (section_id, row_label, sort_order)
      VALUES (section_config.section_id, row_num::TEXT, row_num)
      RETURNING id INTO r_id;
      FOR seat_num IN 1..section_config.n_seats LOOP
        INSERT INTO public.seats (row_id, seat_label)
        VALUES (r_id, seat_num::TEXT);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
