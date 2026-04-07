-- orders tablosuna order_number kolonu ekle (DDMMYYYY-XXXXXX formatında)

-- 1) Kolon yoksa ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'order_number'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN order_number TEXT UNIQUE;
    
    COMMENT ON COLUMN public.orders.order_number IS 'Sipariş numarası (DDMMYYYY-XXXXXX formatında, örn: 07042026-000001)';
  END IF;
END $$;

-- 2) Sipariş numarası üreten fonksiyon
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  v_date_part TEXT;
  v_sequence INT;
  v_order_number TEXT;
BEGIN
  -- Bugünün tarihi DDMMYYYY formatında
  v_date_part := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');
  
  -- Bugün için mevcut son numarayı bul
  SELECT COUNT(*) + 1 INTO v_sequence
  FROM public.orders
  WHERE order_number LIKE v_date_part || '-%';
  
  -- Sipariş numarasını oluştur (DDMMYYYY-XXXXXX)
  v_order_number := v_date_part || '-' || LPAD(v_sequence::TEXT, 6, '0');
  
  RETURN v_order_number;
END;
$$ LANGUAGE plpgsql;

-- 3) Yeni siparişler için otomatik order_number üreten trigger
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur (önce varsa sil)
DROP TRIGGER IF EXISTS trg_set_order_number ON public.orders;

CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- 4) Mevcut siparişlere order_number ata (eğer boşsa)
DO $$
DECLARE
  rec RECORD;
  v_counter INT := 1;
BEGIN
  FOR rec IN 
    SELECT id, created_at 
    FROM public.orders 
    WHERE order_number IS NULL OR order_number = ''
    ORDER BY created_at ASC
  LOOP
    UPDATE public.orders 
    SET order_number = TO_CHAR(rec.created_at::DATE, 'DDMMYYYY') || '-' || LPAD(v_counter::TEXT, 6, '0')
    WHERE id = rec.id;
    v_counter := v_counter + 1;
  END LOOP;
END $$;
