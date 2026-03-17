# Proje Uyumluluk Özeti ve Öneriler

Bu dokümanda yapılan uyumluluk düzeltmeleri ve ileride tamamlanabilecek öneriler özetlenmiştir.

---

## Yapılan Düzeltmeler (Bu Turda)

### 1. Supabase Admin Client – Tek Merkez
- **Sorun:** Birçok API route kendi `getSupabaseAdmin()` veya inline `createClient(..., SERVICE_ROLE_KEY)` kullanıyordu.
- **Çözüm:** `src/lib/supabase-admin.ts` eklendi; `getSupabaseAdmin()` tek yerden export ediliyor.
- **Güncellenen dosyalar:**
  - `src/lib/api-auth.ts` – artık `getSupabaseAdmin` kullanıyor
  - `src/app/api/upload/route.ts`
  - `src/app/api/admin/users/route.ts`
  - `src/app/api/admin/customer-by-kundennummer/route.ts`
  - `src/app/api/news/route.ts`, `src/app/api/news/[id]/route.ts`
  - `src/app/api/advertisements/route.ts`, `src/app/api/advertisements/[id]/route.ts`
  - `src/app/api/audit-logs/route.ts`
  - `src/app/api/purchase/route.ts`
  - `src/app/api/user/orders/route.ts`

### 2. Events API Hata Davranışı
- **Sorun:** `/api/events` hata durumunda `200` + boş dizi dönüyordu; hata ayıklama zordu.
- **Çözüm:** Veritabanı/exception hatalarında `500` ve tutarlı mesaj: `"Etkinlikler yüklenirken bir hata oluştu."` dönülüyor; loglama eklendi.
- **Not:** `useEvents` hook’u `!res.ok` durumunda zaten boş dizi kullanıyor; mevcut frontend davranışı korunuyor.

### 3. Locale / Mesaj Yükleme
- **Sorun:** Locale-prefix’li sayfalarda hem root layout hem `[locale]/layout` mesaj yüklüyordu (çift yükleme).
- **Çözüm:** Root layout’ta path’te `/tr/`, `/de/`, `/en/` varsa mesaj yüklenmiyor; sadece `[locale]/layout` yüklüyor. Locale-prefix olmayan sayfalar (giris, yonetim) için root’ta mesaj yüklenmeye devam ediyor.

### 4. Çift Route Kontrolü
- **Durum:** `/impressum`, `/cerez-politikasi`, `/mesafeli-satis-sozlesmesi`, `/kullanim-kosullari`, `/sss` zaten `/[locale]/bilgilendirme/...` sayfalarına yönlendiriyor; ek değişiklik gerekmedi.

---

## Öneriler (İleride Yapılabilecekler)

### API ve Veri Katmanı
- **Event verisi:** Etkinlik listesi şu an `/api/events` (client), detay/şehir/takvim ise sunucu tarafında doğrudan Supabase ile alınıyor. İsterseniz detay/şehir/takvim için de ortak bir API katmanı (örn. `getEventBySlug`, `getEventsForCity` sunan route’lar) eklenebilir; kod tekrarı azalır.
- **Hata mesajları:** API hata cevaplarında dil (TR/EN/DE) veya `Accept-Language` ile seçim henüz yok; ileride i18n ile tutarlı hata mesajları eklenebilir.
- **Rate limiting:** Kritik endpoint’ler (purchase, login, upload) için rate limit eklenmesi güvenlik ve stabilite için faydalı olur.

### Auth ve Yetkilendirme
- **Admin route’lar:** Bazı yönetim API’leri `requireAdmin`/`requireRole` kullanıyor; hepsinin aynı guard’lardan geçtiğinden emin olmak için kısa bir denetim yapılabilir.
- **Organizer guard:** Organizatör sayfalarında `OrganizerOrAdminGuard` kullanımının tüm yönetim sayfalarında tutarlı olduğu kontrol edilebilir.

### i18n
- **Mesaj anahtarları:** `messages/tr.json`, `en.json`, `de.json` anahtarlarının üç dilde de aynı olduğundan emin olmak için (eksik çeviri uyarısı veren) bir script veya lint kuralı eklenebilir.
- **API hata mesajları:** Sunucu dönen `error` string’lerinin de çeviri anahtarı veya locale’e göre metin üretmesi ileride düşünülebilir.

### Test ve Kalite
- **E2E:** Kritik akışlar (bilet ekleme → sepet → ödeme, giriş, organizatör başvurusu) için Playwright/Cypress ile temel E2E testleri eklenebilir.
- **API testleri:** Purchase, user/orders, events gibi route’lar için birim veya entegrasyon testleri yazılabilir.

### Dokümantasyon
- **README:** Proje kökünde kurulum, env değişkenleri ve çalıştırma adımlarını özetleyen bir README (veya mevcut README güncellemesi) yararlı olur.
- **Env örnek:** `.env.example` ile `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` vb. listelemek güvenli kurulumu kolaylaştırır.

---

## Kısa Özet

| Konu | Durum |
|------|--------|
| Supabase admin client | Tek modülde toplandı (`lib/supabase-admin.ts`) |
| Events API hata | 500 + mesaj + log |
| Locale mesaj yükleme | Çift yükleme azaltıldı |
| Çift legal route’lar | Zaten redirect; değişiklik yok |
| Öneriler | Yukarıdaki maddeler ileride uygulanabilir |

Proje şu an tutarlı ve bakımı kolay bir yapıda; öneriler isteğe bağlı iyileştirmeler içindir.

---

## Uygulanan Öneriler (İkinci Tur)

- **Ortak event katmanı:** `src/lib/events-server.ts` eklendi; `getEventBySlug`, `getEventsByShowSlug`, `getEventsForCity`, `getEventsForCalendar`, `getVenue`, `getEventTickets`, `getOrganizerDisplayName` tek yerden kullanılıyor. Etkinlik detay, şehir ve takvim sayfaları bu lib’i kullanacak şekilde güncellendi.
- **Kurulum dokümantasyonu:** `docs/KURULUM.md` eklendi (kurulum, env, çalıştırma, `scripts/check-i18n-keys.js`).
- **i18n anahtar kontrolü:** `scripts/check-i18n-keys.js` – tr/en/de mesaj dosyalarında eksik veya fazla anahtarları raporlar (tr referans).
- **API guard’lar:** Admin/organizer koruması eklendi:
  - `requireAdmin`: admin/users (GET, POST), audit-logs (GET), news (POST), news/[id] (PUT), advertisements (POST), advertisements/[id] (PUT, DELETE).
  - `requireRole(["admin", "organizer"])`: upload, orders, organizer/orders.
  - checkin-ticket ve organizer/dashboard zaten requireRole kullanıyordu.
- **orders route:** `getSupabaseAdmin` ve `requireRole(["admin", "organizer"])` kullanacak şekilde güncellendi.
- **organizer/orders:** `requireRole` ve `getSupabaseAdmin` kullanacak şekilde sadeleştirildi.
