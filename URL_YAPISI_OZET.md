# URL yapısı – değiştirilen dosyalar ve etkileri

## Sonuç: Link üretimini değiştiren dosya yok

Tüm etkinlik linkleri hâlâ aynı formatta üretiliyor:
- `show_slug || event.id` → örn. `/etkinlik/erdal-kaya` veya `/etkinlik/d338019a-...`
- next-intl `Link` bileşeni buna otomatik locale ekliyor → `/tr/etkinlik/erdal-kaya`

**Hiçbir değişiklikte `href` veya link formatı değiştirilmedi.**

---

## URL’in “bozulmasının” asıl nedeni: middleware

**Sorun:** İstek `/tr/etkinlik/erdal-kaya` olarak geliyordu ama **next-intl middleware** (`intlMiddleware`) path’i **rewrite** ediyordu. Next.js’e giden path büyük ihtimalle `/etkinlik/erdal-kaya` oluyordu (locale kaldırılıyor).

**Sonuç:** App Router segmentleri yanlış eşlendi:
- Beklenen: `[locale]=tr`, `[id]=erdal-kaya`
- Olan: `[locale]=etkinlik`, `[id]=erdal-kaya`  
→ `[locale]` layout’u sadece `tr|de|en` kabul ettiği için `"etkinlik"` → **notFound()** → “Sayfa bulunamadı”.

**Yapılan düzeltme (middleware.ts):** Path zaten `/tr/`, `/de/` veya `/en/` ile başlıyorsa **intlMiddleware çağrılmıyor**, `NextResponse.next()` ile aynen geçiriliyor. Böylece rewrite olmuyor, segmentler doğru: `[locale]=tr`, `[id]=erdal-kaya`.

---

## Değiştirilen dosyalar ve URL ile ilişkisi

| Dosya | Ne değişti | URL yapısını değiştirir mi? |
|-------|------------|------------------------------|
| **middleware.ts** | `/tr|de|en/` ile başlayan isteklerde intlMiddleware atlanıyor, doğrudan `next()` | **Evet – düzeltir.** Rewrite’ı kaldırdık, segmentler doğru çözülüyor. |
| **supabase-server.ts** | Env her istekte okunuyor, `createServerSupabaseAdmin` eklendi | Hayır. Sadece veri çekme. |
| **etkinlik/[id]/page.tsx** | Admin client, show_slug önce, UUID/fallback, dev’de is_approved filtresiz deneme | Hayır. Sadece “hangi etkinlik” bulunuyor, URL üretilmiyor. |
| **next.config.mjs** | Sentry sadece production | Hayır. |
| **hooks/useEvents.ts, useNews.ts** | default export | Hayır. |
| **ClientHomePage.tsx** | useEvents/useNews default import | Hayır. Link hâlâ `href={/etkinlik/${show_slug \|\| event.id}}`. |
| **YARIN_DENE_ETKINLIK_LINK.md** | Dokümantasyon | Hayır. |
| **query-event-links.sql** | Sorgu dosyası | Hayır. |

---

## Link üretiminin yapıldığı yerler (bunlara dokunulmadı)

- `ClientHomePage.tsx`: `/etkinlik/${show_slug || event.id}`
- `EventSlider.tsx`: `/etkinlik/${show_slug || currentEvent.id}`
- `CityPageClient.tsx`: `/etkinlik/${show_slug || event.id}`
- `sanatci/[slug]/page.tsx`: `/etkinlik/${show_slug || event.id}`
- `ShowDetailClient.tsx`: `/etkinlik/${event.id}`
- `etkinlik/[id]/page.tsx` (metadata): `getSiteUrl()/etkinlik/${event.slug || event.id}`

Hepsi aynı mantık: **show_slug varsa o, yoksa id (veya slug)**. URL yapısı bu dosyalarda değiştirilmedi.

---

## Özet

- **URL yapısı neden bozuldu?**  
  Link formatı değişmedi. Bozulan şey, **middleware’de** `/tr/etkinlik/...` isteğinin next-intl tarafından rewrite edilmesi ve `[locale]` segmentinin yanlış (örn. `"etkinlik"`) gelmesi.

- **Hangi değişiklik düzeltiyor?**  
  Sadece **middleware.ts**’teki değişiklik: path `/tr/`, `/de/` veya `/en/` ile başlıyorsa intlMiddleware’e hiç girmeden `next()` ile geçmek. Böylece path ve segmentler doğru kalıyor.

- **Diğer tüm değişen dosyalar** veri çekme (Supabase client, fallback, dev is_approved) veya build/config (Sentry, hooks) ile ilgili; **URL üretimini veya route çözümlemesini değiştirmiyor.**
