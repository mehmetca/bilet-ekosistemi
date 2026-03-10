-- Faz 2: Oturum planı (seating plan) veri modeli – koltuk seçimi için
-- Venue'ye bağlı plan → bölümler (sections) → sıralar (rows) → koltuklar (seats)

-- 1) Oturum planı (mekana bağlı, bir mekanda birden fazla plan olabilir)
CREATE TABLE IF NOT EXISTS public.seating_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seating_plans_venue ON public.seating_plans(venue_id);

-- 2) Bölümler (Blok A, Parket, Balkon vb.)
CREATE TABLE IF NOT EXISTS public.seating_plan_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seating_plan_id UUID NOT NULL REFERENCES public.seating_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seating_plan_sections_plan ON public.seating_plan_sections(seating_plan_id);

-- 3) Sıralar (her bölümde sıra etiketleri: 1, 2, A, B vb.)
CREATE TABLE IF NOT EXISTS public.seating_plan_rows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.seating_plan_sections(id) ON DELETE CASCADE,
  row_label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seating_plan_rows_section ON public.seating_plan_rows(section_id);

-- 4) Koltuklar (sıra + koltuk no; x,y opsiyonel – görsel plan için)
CREATE TABLE IF NOT EXISTS public.seats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  row_id UUID NOT NULL REFERENCES public.seating_plan_rows(id) ON DELETE CASCADE,
  seat_label TEXT NOT NULL,
  x NUMERIC(10,4),
  y NUMERIC(10,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(row_id, seat_label)
);

CREATE INDEX idx_seats_row ON public.seats(row_id);

-- 5) Etkinlik hangi oturum planını kullanıyor (opsiyonel; dolu ise "Yer seçerek bilet al" açılır)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS seating_plan_id UUID REFERENCES public.seating_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_seating_plan ON public.events(seating_plan_id);

-- RLS: Mekanlarla aynı mantık – herkes okuyabilir, sadece admin/controller yönetir
ALTER TABLE public.seating_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_plan_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_plan_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read seating_plans" ON public.seating_plans FOR SELECT USING (true);
CREATE POLICY "Admins manage seating_plans" ON public.seating_plans FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));

CREATE POLICY "Anyone can read seating_plan_sections" ON public.seating_plan_sections FOR SELECT USING (true);
CREATE POLICY "Admins manage seating_plan_sections" ON public.seating_plan_sections FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));

CREATE POLICY "Anyone can read seating_plan_rows" ON public.seating_plan_rows FOR SELECT USING (true);
CREATE POLICY "Admins manage seating_plan_rows" ON public.seating_plan_rows FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));

CREATE POLICY "Anyone can read seats" ON public.seats FOR SELECT USING (true);
CREATE POLICY "Admins manage seats" ON public.seats FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller')));
