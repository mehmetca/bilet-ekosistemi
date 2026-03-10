# Local vs Vercel Karşılaştırma – Soruna Neden Olabilecek Dosyalar

## Klasör / konum değişikliği

**Yok.** Tüm 67 dosya sadece **M (Modified)**; hiçbiri taşınmamış veya yeniden adlandırılmamış.  
Yani sorun **dosya/klasör yerinin değişmesinden** kaynaklanmıyor.

---

## Soruna neden olabilecek dosyalar (önem sırasıyla)

### 1. `middleware.ts` — En kritik (routing / 404)

**Vercel’deki (eski):**
- `/tr/etkinlik/erdal-kaya` gibi istekler **intlMiddleware**’e gidiyor.
- next-intl path’i rewrite edince **segmentler kayıyor**: `[locale]` = `"etkinlik"`, `[id]` = `erdal-kaya` gibi.
- `[locale]` layout’u sadece `tr|de|en` kabul ettiği için **notFound()** tetikleniyor → **404**.

**Local’deki (yeni):**
- Path **zaten `/tr/`, `/de/` veya `/en/` ile başlıyorsa** intlMiddleware’e hiç girilmiyor, `NextResponse.next()` ile aynen geçiliyor.
- Böylece `[locale]` = `tr`, `[id]` = `erdal-kaya` doğru kalıyor, 404 oluşmuyor.
- Ek olarak: `/etkinlik/xxx` → `/${defaultLocale}/etkinlik/xxx` redirect’i var.

**Sonuç:** Local’de etkinlik sayfasının açılması büyük ölçüde bu middleware değişikliğine bağlı. Vercel’de eski middleware kaldığı sürece orada da aynı 404 riski vardır (veya farklı bir davranış).

---

### 2. `src/app/[locale]/etkinlik/[id]/page.tsx` — Veri bulma / 404

**Vercel’deki (eski):**
- `createServerSupabase()` (anon key).
- Önce slug, bulunamazsa id ile tek sorgu; basit fallback.

**Local’deki (yeni):**
- `createServerSupabaseAdmin()` (service role, RLS bypass).
- Sıra: **show_slug** → slug → id (UUID tireli/tiresiz); dev’de bulunamazsa **is_approved filtresiz** tekrar deneme.
- `unstable_cache`, `getStorageImageUrl`, tek etkinlikte de show_slug sayfası (1+ etkinlik).

**Sonuç:** Vercel’de anon + RLS ile bazı etkinlikler görünmeyebilir veya slug/id farkından 404 olabilir. Local’de admin + show_slug + dev fallback ile sayfa açılıyor. **Etkinlik bulunamadı** 404’ü bu dosyadaki farktan etkilenir.

---

### 3. `src/lib/supabase-server.ts` — Veri erişimi

**Vercel’deki (eski):**
- Sadece `createServerSupabase()` (anon key). Env bir kez okunuyordu.

**Local’deki (yeni):**
- `createServerSupabase()` + **`createServerSupabaseAdmin()`** (service role).
- Env her çağrıda okunuyor.

**Sonuç:** Etkinlik sayfası local’de admin client kullanıyor. Vercel’de admin yok; orada anon + RLS kullanılıyor. RLS kurallarına göre **local’de açılıp Vercel’de 404** veya tersi görülebilir.

---

### 4. `src/app/[locale]/layout.tsx` — Locale / mesajlar

**Vercel’deki (eski):**
- `import(\`../../../messages/${locale}.json\`)`.

**Local’deki (yeni):**
- `import(\`@messages/${locale}.json\`)` + `LOCALES` const, wrapper `<div key={locale}>`.

**Sonuç:** `@messages` alias’ı **next.config.mjs**’te sadece local’de tanımlı. Vercel’de bu alias yoksa layout’taki mesaj import’u build/runtime’da hata verebilir; dolaylı olarak sayfa 404 veya hata sayfası gösterebilir.

---

### 5. `next.config.mjs` — Build / alias

**Vercel’deki (eski):**
- `instrumentationHook: false`.
- `@messages` alias yok.
- Sentry tüm ortamlarda eklenebiliyor.

**Local’deki (yeni):**
- `instrumentationHook: true`.
- `config.resolve.alias["@messages"] = path.join(process.cwd(), "messages")`.
- Sentry sadece `NODE_ENV === "production"`.

**Sonuç:** Vercel’de `@messages` olmadığı için **layout / i18n request** mesaj yükleyemezse sayfa bozulabilir. Instrumentation ve Sentry farkı daha çok build/hata davranışını etkiler.

---

### 6. `src/i18n/request.ts` — Mesaj yükleme

**Vercel’deki (eski):**
- `import(\`../../messages/${locale}.json\`)`.

**Local’deki (yeni):**
- `import(\`@messages/${locale}.json\`)`.

**Sonuç:** next.config’te `@messages` alias’ı Vercel’de yoksa bu import orada kırılır; locale/mesaj hatası veya sayfa hatası görülebilir.

---

## Özet tablo

| Dosya | Soruna etkisi | Açıklama |
|-------|----------------|----------|
| **middleware.ts** | **Yüksek** | `/tr/etkinlik/...` isteklerinde segment kayması → 404. Local’de düzeltme var. |
| **etkinlik/[id]/page.tsx** | **Yüksek** | Veri client’ı (admin vs anon), show_slug, dev fallback. 404 veya “event not found”. |
| **supabase-server.ts** | **Orta** | Admin client sadece local’de; Vercel’de RLS/anon farkı. |
| **[locale]/layout.tsx** | **Orta** | `@messages` kullanımı; alias yoksa build/run hata. |
| **next.config.mjs** | **Orta** | `@messages` alias + Sentry/instrumentation. |
| **i18n/request.ts** | **Orta** | `@messages`; alias yoksa mesaj yüklenemez. |

**Klasör değişikliği:** Yok (hepsi M, hiç R/A/D yok).

Bu dosyaları Vercel’e taşıyıp (commit + push) deploy edersen, local ile Vercel davranışı aynı yöne çekilir; 404 farkı da büyük ihtimalle buradaki farklardan kaynaklanıyordur.
