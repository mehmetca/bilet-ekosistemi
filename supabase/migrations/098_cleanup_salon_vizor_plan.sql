-- Eski "Salon Tasarım Vizörü" sayfası kaldırıldığı için site_settings tablosundaki
-- ilgili JSON taslağını ('salon_tasarim_vizor_plan') temizler.
-- Yeni Salon Yapım Wizard taslakları 'salon_yapim_wizard_plan' anahtarı altında tutulur.
DELETE FROM public.site_settings
WHERE key = 'salon_tasarim_vizor_plan';
