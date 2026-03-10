-- Ana sayfada gösterilecek öne çıkan 2 etkinliği yönetim panelinden seçebilmek için
-- homepage_featured_order: 1 = sol, 2 = sağ. null = öne çıkan değil.
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS homepage_featured_order integer CHECK (homepage_featured_order IN (1, 2));
