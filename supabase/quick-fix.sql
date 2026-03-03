-- Hızlı Düzeltme Script'i
-- Supabase SQL Editor'da çalıştırın

-- 1. Events tablosunu oluştur (yoksa)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  venue TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('konser', 'tiyatro', 'spor', 'workshop', 'diger')),
  price_from DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tickets tablosunu oluştur (yoksa)
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('normal', 'vip')),
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 100,
  sold INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Orders tablosunu oluştur (yoksa)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  ticket_code TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. User roles tablosunu oluştur (yoksa)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'controller')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RLS'i devre dışı bırak (geçici çözüm)
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 6. Basit test verisi ekle
INSERT INTO public.events (title, description, date, time, venue, location, category, price_from)
VALUES 
  ('Test Etkinliği', 'Bu bir test etkinliğidir.', CURRENT_DATE + INTERVAL '7 days', '20:00', 'Test Mekanı', 'Test Şehri', 'konser', 100.00)
ON CONFLICT DO NOTHING;

-- 7. Sonuçları kontrol et
SELECT 
  'Events' as tablo, COUNT(*) as sayi FROM public.events
UNION ALL
SELECT 
  'Tickets' as tablo, COUNT(*) as sayi FROM public.tickets
UNION ALL
SELECT 
  'Orders' as tablo, COUNT(*) as sayi FROM public.orders
UNION ALL
SELECT 
  'User Roles' as tablo, COUNT(*) as sayi FROM public.user_roles;
