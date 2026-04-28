# Local vs Vercel Dosya Yapısı Karşılaştırması

**Son kontrol:** Bu rapor `git status` ve `git ls-files` çıktısına göre üretildi.

**Önemli:** Vercel, bağlı olduğu Git deposundaki **son push edilmiş** commit’i deploy eder. Yani:
- **Vercel’deki yapı** = Git’te commit edilip push edilmiş dosyalar
- **Local’deki yapı** = Şu an diskte gördüğün tüm dosyalar (commit edilmemiş + untracked dahil)

---

## Sonuç: Aynı mı?

**Hayır.** Local ile Vercel şu an **aynı değil**, çünkü:

1. **Birçok dosya değiştirilmiş ama commit edilmemiş** (M) → Vercel’de eski hâlleri var.
2. **Bazı dosya/klasörler sadece local’de** (??) → Vercel’de hiç yok.

---

## 1. Sadece Local’de Olan (Vercel’de Yok) – Untracked

Bu dosya/klasörler Git’te yok; Vercel’e push edilmediği sürece **Vercel’de bulunmaz**.

| Dosya / Klasör |
|----------------|
| `GELISTIRME_KOMUTLARI.md` |
| `URL_YAPISI_OZET.md` |
| `YARIN_DENE_ETKINLIK_LINK.md` |
| `docs/ENDPOINT_AUDIT.md` |
| `docs/SUPABASE_EMAIL_TEMPLATE_SIFRE_SIFIRLAMA.md` |
| `src/app/[locale]/default.tsx` |
| `src/app/[locale]/etkinlik/[id]/default.tsx` |
| `src/app/api/checkin-ticket/` (tüm içeriği) |
| `src/app/api/events/` (içindeki `compare/` route vb.) |
| `src/app/api/organizer/` (tüm içeriği) |
| `src/app/api/test-supabase/` |
| `src/app/sifre-yenile/` |
| `src/app/test-env/` |
| `src/app/yonetim/AdminLayoutClient.tsx` |
| `src/app/yonetim/satis-raporu/` |
| `src/components/OrganizerDashboard.tsx` |
| `src/components/OrganizerOrAdminGuard.tsx` |
| `src/components/RouteKeyWrapper.tsx` |
| `src/hooks/` (tüm içeriği) |
| `src/lib/api-auth.ts` |
| `src/lib/storage-image.ts` |
| `supabase/migrations/056_tickets_and_events_list_indexes.sql` … `066_*` ve diğer listelenen migration’lar |
| `supabase/migrations/check-erdal-kaya.sql`, `check-event-slugs.sql`, `find-erdal-kaya.sql`, `fix-duplicate-slugs.sql`, `fix-event-slugs.sql` |
| `supabase/query-event-links.sql` |
| `tsconfig.tsbuildinfo` |

---

## 2. Değiştirilmiş (M) – Vercel’de Eski, Local’de Yeni

Bu dosyalar Git’te var ama **local’de değiştirilmiş**, henüz commit/push edilmemiş. Vercel’de **commit’teki eski içerik** vardır.

- `.env.example`
- `instrumentation-client.ts`
- `messages/de.json`, `messages/en.json`, `messages/tr.json`
- `middleware.ts`
- `next.config.mjs`
- `package.json`, `package-lock.json`
- `src/app/[locale]/ClientHomePage.tsx`
- `src/app/[locale]/city/[slug]/CityPageClient.tsx`, `page.tsx`
- `src/app/[locale]/etkinlik/[id]/client.tsx`, `page.tsx`
- `src/app/[locale]/haber/[id]/client.tsx`, `page.tsx`
- `src/app/[locale]/layout.tsx`, `page.tsx`
- `src/app/[locale]/sanatci/[slug]/page.tsx`
- `src/app/[locale]/sepet/page.tsx`, `takvim/page.tsx`
- `src/app/api/` altında birçok route (admin, advertisements, analytics, audit-logs, check-ticket, news, orders, organizer-request, profile, purchase, upload)
- `src/app/giris/page.tsx`, `layout.tsx`
- `src/app/yonetim/` altında birçok sayfa (audit-log, bilet-kontrol, bilet-listesi, etkinlikler, huni-analitigi, kullanicilar, layout, mekanlar, muhasebe, sehirler, siparisler)
- `src/components/` (AdminKPIDashboard, AdminNavigationFixed, AdminPolicyHeader, AdvertisementBanner, AdvertisementGrid, BiletlerimSection, EventCalendar, EventSlider, Header, HeroBackgroundSlider, MultiTicketScanner, NewsSlider, QRScanner, YonetimDashboard)
- `src/i18n/request.ts`
- `src/lib/date-utils.ts`, `supabase-server.ts`
- `src/types/database.ts`
- `supabase/migrations/028_funnel_analytics.sql`
- `tsconfig.json`

---

## 3. Git’te Olup Vercel’de Olan (Değişmemiş)

`git ls-files` ile listelenen ve yukarıdaki listelerde **yer almayan** tüm dosyalar hem Git’te hem de (son push’ta) Vercel’de vardır ve local ile commit’teki hâlleri aynıdır.

---

## Local ile Vercel’i Aynı Yapmak İçin

1. **Tüm değişiklikleri commit et:**
   ```bash
   git add -A
   git status   # Kontrol
   git commit -m "Local ile Vercel senkron: default.tsx, date-utils, instrumentation, api/events/compare, hooks, vb."
   ```

2. **Vercel’e gönder:**
   ```bash
   git push origin main
   ```
   (Dal adın `main` değilse kullandığın dalı yaz.)

3. **Untracked dosyaları da Vercel’de istiyorsan** mutlaka `git add` ile ekleyip commit/push et. İstemediğin dosyalar için `.gitignore` kullan.

Bu adımlardan sonra Vercel, bir sonraki deploy’da local’deki (commit’teki) dosya yapısı ve içerikle aynı olur.
