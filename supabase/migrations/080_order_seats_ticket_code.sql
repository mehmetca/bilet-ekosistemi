-- order_seats tablosuna ticket_code kolonu ekle (her bilet için benzersiz kod)

-- 1) Kolon yoksa ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_seats' 
    AND column_name = 'ticket_code'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.order_seats ADD COLUMN ticket_code TEXT;
    
    COMMENT ON COLUMN public.order_seats.ticket_code IS 'Her bilet (koltuk) için benzersiz bilet kodu (örn: BLT-XXXXXXXX)';
  END IF;
END $$;

-- 2) Mevcut order_seats kayıtlarına ticket_code ata (eğer boşsa)
-- Her koltuk için ayrı kod üret (mevcut sipariş kodunu temel al)
UPDATE public.order_seats os
SET ticket_code = o.ticket_code || '-' || substr(md5(os.id::text), 1, 4)
FROM public.orders o
WHERE os.order_id = o.id
AND (os.ticket_code IS NULL OR os.ticket_code = '');

-- 3) Index ekle (unique DEĞİL - çünkü aynı kod kontrol için kullanılabilir)
CREATE INDEX IF NOT EXISTS idx_order_seats_ticket_code ON public.order_seats(ticket_code);
