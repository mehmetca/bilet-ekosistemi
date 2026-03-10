-- Organizatöre atanmış bilet kontrolörleri: Bu kontrolörler sadece ilgili organizatörün etkinliklerinde check-in yapabilir.
-- Bir kontrolör en fazla bir organizatöre atanabilir; atanmamış kontrolörler tüm etkinliklerde check-in yapabilir (mevcut davranış).
CREATE TABLE IF NOT EXISTS public.organizer_controllers (
  organizer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  controller_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (controller_user_id)
);

COMMENT ON TABLE public.organizer_controllers IS 'Kontrolör kullanıcılarının hangi organizatöre ait etkinliklerde check-in yapabileceğini tanımlar. Atanmamış kontrolörler tüm etkinliklerde çalışır.';

CREATE INDEX IF NOT EXISTS idx_organizer_controllers_organizer ON public.organizer_controllers(organizer_user_id);

ALTER TABLE public.organizer_controllers ENABLE ROW LEVEL SECURITY;

-- Sadece admin yönetebilir (organizatör ataması)
DROP POLICY IF EXISTS "Admin can manage organizer_controllers" ON public.organizer_controllers;
CREATE POLICY "Admin can manage organizer_controllers" ON public.organizer_controllers
  FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Kontrolör kendi atamasını okuyabilir (check-in sayfasında yetki kontrolü için API kullanıyor, RLS daha çok admin paneli için)
DROP POLICY IF EXISTS "Controller can view own assignment" ON public.organizer_controllers;
CREATE POLICY "Controller can view own assignment" ON public.organizer_controllers
  FOR SELECT
  USING (controller_user_id = auth.uid());
