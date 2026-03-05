-- Hero B varyantı: "Türkiye'nin en güvenilir bilet platformu" -> "Güvenilir bilet platformu"
UPDATE public.ab_variants
SET hero_subtitle = 'Güvenilir bilet platformu. Binlerce etkinlik, tek tıkla bilet.'
WHERE experiment_id = 'a0000000-0000-0000-0000-000000000001'::uuid
  AND variant_key = 'B';
