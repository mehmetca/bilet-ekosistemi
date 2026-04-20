-- A/B test altyapısı: Hero ve CTA varyantları
CREATE TABLE IF NOT EXISTS public.ab_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ab_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.ab_experiments(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  hero_title text,
  hero_subtitle text,
  cta_text text,
  weight int NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, variant_key)
);

-- event_views ve purchase_intents'e hero_variant ekle (hangi hero varyantını gördü)
ALTER TABLE public.event_views ADD COLUMN IF NOT EXISTS hero_variant text;
ALTER TABLE public.purchase_intents ADD COLUMN IF NOT EXISTS hero_variant text;

-- RLS
ALTER TABLE public.ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active experiments" ON public.ab_experiments;
CREATE POLICY "Anyone can read active experiments" ON public.ab_experiments
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can read variants" ON public.ab_variants;
CREATE POLICY "Anyone can read variants" ON public.ab_variants
  FOR SELECT USING (
    experiment_id IN (SELECT id FROM public.ab_experiments WHERE is_active = true)
  );

DROP POLICY IF EXISTS "Admins can manage experiments" ON public.ab_experiments;
CREATE POLICY "Admins can manage experiments" ON public.ab_experiments
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

DROP POLICY IF EXISTS "Admins can manage variants" ON public.ab_variants;
CREATE POLICY "Admins can manage variants" ON public.ab_variants
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'controller'))
  );

-- Varsayılan experiment ve varyantlar (id conflict olursa atla)
INSERT INTO public.ab_experiments (id, name, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'hero_cta_2024', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ab_variants (experiment_id, variant_key, hero_title, hero_subtitle, cta_text, weight) VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'A', 'Hayalinizdeki Etkinliğe Bilet Bulun', E'Konser, tiyatro, stand-up ve daha fazlası.\nGüvenli ödeme ile kolayca bilet alın.', 'Ara', 50),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'B', 'Bilet Bul, Anında Al', E'Konser, tiyatro, stand-up ve daha fazlası.\nGüvenli ödeme ile kolayca bilet alın.', 'Etkinlikleri Keşfet', 50)
ON CONFLICT (experiment_id, variant_key) DO UPDATE SET
  hero_title = EXCLUDED.hero_title,
  hero_subtitle = EXCLUDED.hero_subtitle,
  cta_text = EXCLUDED.cta_text,
  weight = EXCLUDED.weight;
