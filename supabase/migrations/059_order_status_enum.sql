-- Status için enum: Geçersiz değer girilmesi engellenir, tip güvenliği sağlanır.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('pending', 'completed', 'cancelled');
  END IF;
END
$$;

-- Mevcut CHECK constraint varsa kaldır (enum kendi kısıtını getirir)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- status sütununu enum yap (TEXT ise)
-- Önce default kaldırılmalı, yoksa tip dönüşümü hata verir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE public.orders
      ALTER COLUMN status TYPE public.order_status
      USING (
        CASE status::text
          WHEN 'pending'   THEN 'pending'::public.order_status
          WHEN 'completed' THEN 'completed'::public.order_status
          WHEN 'cancelled' THEN 'cancelled'::public.order_status
          WHEN 'confirmed' THEN 'completed'::public.order_status
          ELSE 'completed'::public.order_status
        END
      );

    ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'completed'::public.order_status;
  END IF;
END
$$;

COMMENT ON TYPE public.order_status IS 'Sipariş durumu: pending=beklemede, completed=tamamlandı, cancelled=iptal';
