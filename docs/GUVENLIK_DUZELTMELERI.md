# Güvenlik Düzeltmeleri

Bu belge, güvenlik analizinde tespit edilen yüksek ve orta riskli bulguların düzeltmelerini özetler.

---

## Yüksek Risk Düzeltmeleri

### 1. `/api/barcode` — Rate Limit + Input Validation

**Risk:** Herhangi biri sınırsız barkod üretme isteği gönderebilir (DoS riski). Kod formatı doğrulanmıyordu.

**Düzeltme (`src/app/api/barcode/route.ts`):**
- **In-memory rate limiter** eklendi: IP başına dakikada maksimum **30 istek**.
  - Limit aşılırsa `429 Too Many Requests` + `Retry-After: 60` header döner.
  - IP, `x-forwarded-for` veya `x-real-ip` header'ından alınır.
- **Kod format doğrulaması** güçlendirildi: yalnızca `A-Z`, `0-9`, `-` karakterleri; 4–32 karakter uzunluğu.
  - Geçersiz formatta `400 Invalid code` döner.

> **Not:** Production ortamında yüksek trafik beklentisi varsa in-memory yerine Redis tabanlı rate limiter (örn. `@upstash/ratelimit`) tercih edilmelidir.

---

### 2. `/api/purchase` — Input Validation Güçlendirme

**Risk:** `quantity` alanına NaN veya float değer gönderilebilir; `buyerName` için uzunluk sınırı yoktu.

**Düzeltme (`src/app/api/purchase/route.ts`):**
- `quantity` için `Number.isInteger()` kontrolü eklendi — NaN/float değerler `400 Geçersiz adet değeri` ile reddedilir.
- `buyerName` için **200 karakter** uzunluk sınırı eklendi — aşılırsa `400 İsim çok uzun` döner.

---

## Orta Risk Düzeltmeleri

### 3. `/api/cron/send-reminders` — CRON_SECRET Eksikse Hard Fail

**Risk:** `CRON_SECRET` ortam değişkeni tanımlı değilse endpoint `401` döndürüyordu; bu durum yanlış yapılandırmayı gizleyebilir.

**Düzeltme (`src/app/api/cron/send-reminders/route.ts`):**
- `CRON_SECRET` **tanımlı değilse** artık `500 Cron endpoint is not configured` ile hard fail yapıyor ve `console.error` ile loglanıyor.
- `CRON_SECRET` tanımlı ama token yanlışsa `401 Unauthorized` döner (önceki davranış korundu).

---

## Mevcut Güvenlik Önlemleri (Değiştirilmedi)

| Bileşen | Durum |
|---------|-------|
| Check-in atomikliği | ✅ `.is("checked_at", null)` ile atomik UPDATE — race condition kapalı |
| Bilet kodu üretimi | ✅ `crypto.randomBytes` — kriptografik güvenli |
| `/api/check-ticket` auth | ✅ Admin/controller/organizer rol kontrolü |
| `/api/checkin-ticket` auth | ✅ Admin/controller/organizer + etkinlik kapsamı |
| `/api/purchase` Stripe doğrulama | ✅ Stripe session + fulfillment token zorunlu |
| `/api/purchase` fiyat doğrulama | ✅ Sunucu taraflı fiyat hesabı; istemci fiyatı kabul edilmez |
| Admin endpoint'leri | ✅ `requireAdmin()` ile korunuyor |
| Cron endpoint | ✅ `CRON_SECRET` Bearer token zorunlu |

---

*Son güncelleme: Güvenlik analizi sonrası otomatik düzeltme.*
