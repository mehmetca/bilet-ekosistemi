# API Endpoint Denetim Listesi

Her endpoint için kontrol: **Rol** | **RLS uyumu** | **Tablo** | **Hata mesajları**.

---

## Sayfa → Endpoint eşlemesi

| Sayfa / İşlem | Endpoint | Not |
|---------------|----------|-----|
| Organizer – Etkinlik listesi | Client-side Supabase (`events`, `created_by_user_id` filtreli) | API yok; RLS: "Organizer can view own events" |
| Admin – Bekleyen etkinlikler | Client-side Supabase (`events`, `is_approved = false`) | API yok; RLS: "Admin can view all events" |
| Admin – Etkinlik onaylama/red | Client-side Supabase `events.update()` | API yok; RLS: "Admins can update events" (043) |
| Bilet satın alma | `POST /api/purchase` | RPC `reserve_tickets_and_create_order` |
| Bilet doğrulama (kapıda) | `POST /api/check-ticket` | Sadece okuma; rol kontrolü eklendi |
| Check-in (giriş işaretleme) | `POST /api/checkin-ticket` | `orders.checked_at` güncelleme; rol: admin/controller/organizer |

---

## Endpoint bazlı denetim

### 1. `POST /api/purchase` (Bilet satın alma)
- **Rol:** Yok (misafir alışveriş; isteğe bağlı `Authorization` ile `user_id` bağlanır).
- **RLS:** Service role ile RPC çağrılıyor; RPC tarafında stok/order yazımı yapılıyor. RLS bypass.
- **Tablolar:** `tickets` (okuma), `orders` (RPC ile insert), `events` (okuma – e-posta için).
- **Hatalar:** 400 (eksik alan, stok yok), 404 (bilet yok), 500 (sunucu/RPC). Mesajlar Türkçe.
- **Durum:** Uyumlu.

---

### 2. `POST /api/check-ticket` (Bilet doğrulama)
- **Rol:** Admin, controller veya organizer (sadece yetkili kişi doğrulayabilsin).
- **RLS:** Service role ile `orders` + `events` okunuyor; API kendi rol kontrolünü yapıyor.
- **Tablolar:** `orders` (SELECT), `events` (SELECT join). Yazma yok.
- **Hatalar:** 401 (oturum yok), 403 (yetki yok), 500 (sunucu). Body: `valid`, `reason`, `message`.
- **Durum:** Rol kontrolü eklendi.

---

### 3. `POST /api/checkin-ticket` (Check-in – giriş işaretleme)
- **Rol:** Admin, controller veya organizer. Organizer sadece kendi etkinliğine ait siparişleri işaretleyebilir.
- **RLS:** Service role ile `orders` güncelleniyor; yetki API’de kontrol ediliyor.
- **Tablolar:** `orders` (SELECT + UPDATE `checked_at`).
- **Hatalar:** 401 (oturum), 403 (yetki / bu etkinliğe yetkiniz yok), 404 (bilet bulunamadı), 400 (zaten kullanılmış / geçersiz durum), 500 (sunucu).
- **Durum:** Yeni endpoint eklendi.

---

### 4. `GET /api/organizer/orders`
- **Rol:** Admin veya organizer. Organizer sadece kendi etkinliklerinin siparişleri.
- **RLS:** Service role; event listesi organizer için `created_by_user_id` ile filtreleniyor.
- **Tablolar:** `user_roles`, `events`, `orders`, `tickets`.
- **Hatalar:** 401, 403 ("Organizatör yetkisi gerekli").
- **Durum:** Uyumlu.

---

### 5. `GET /api/orders` (Tüm siparişler)
- **Rol:** Admin veya controller.
- **RLS:** Service role; erişim sadece bu rollerle sınırlı.
- **Tablolar:** `orders`, `tickets`.
- **Hatalar:** 401, 403.
- **Durum:** Uyumlu.

---

### 6. `GET/POST /api/admin/users`
- **Rol:** Sadece admin.
- **RLS:** Service role; `user_roles`, `organizer_requests`, auth admin.
- **Tablolar:** `user_roles`, `organizer_requests`, `organizer_profiles`, `orders` (user silme öncesi null).
- **Hatalar:** 400, 404, 409, 500. 403 ("Bu işlem için yetkiniz yok").
- **Durum:** Uyumlu.

---

### 7. `GET /api/admin/customer-by-kundennummer`
- **Rol:** Admin, controller veya organizer.
- **RLS:** Service role; profil/sipariş okuma.
- **Tablolar:** `user_roles`, `user_profiles`, `orders`.
- **Hatalar:** 400, 401, 403 ("Yetkisiz"), 500.
- **Durum:** Uyumlu.

---

### 8. `GET /api/audit-logs`, `GET /api/analytics/funnel-stats`
- **Rol:** Admin.
- **RLS:** Service role; okuma.
- **Tablolar:** `audit_logs`; `event_views`, `purchase_intents`, `orders`, `events`.
- **Hatalar:** 401, 403, 500.
- **Durum:** Uyumlu.

---

### 9. `GET/POST /api/advertisements`, `PUT/DELETE /api/advertisements/[id]`
- **Rol:** GET herkese açık; POST/PUT/DELETE sadece admin.
- **RLS:** Service role.
- **Tablolar:** `advertisements`.
- **Hatalar:** 500; 403 admin için.
- **Durum:** Uyumlu.

---

### 10. `GET/POST /api/news`, `PUT/DELETE /api/news/[id]`
- **Rol:** GET herkese; POST/PUT/DELETE admin.
- **RLS:** Service role.
- **Tablolar:** `news`.
- **Hatalar:** 403, 500.
- **Durum:** Uyumlu.

---

### 11. `POST /api/upload`
- **Rol:** Admin veya organizer.
- **RLS:** Service role; Storage.
- **Tablolar:** Yok (Storage bucket).
- **Hatalar:** 400, 403, 500.
- **Durum:** Uyumlu.

---

### 12. `GET /api/user/orders`, `GET/DELETE /api/user/orders/[id]`
- **Rol:** Giriş yapmış kullanıcı; sipariş sadece kendi kaydı.
- **RLS:** Client veya anon key ile çağrılıyorsa RLS "Users see only their orders" ile uyumlu. API tarafında `user_id` / `buyer_email` eşlemesi yapılıyor.
- **Tablolar:** `orders`, `tickets`.
- **Hatalar:** 401, 403 ("Bu siparişe erişim yetkiniz yok"), 500.
- **Durum:** Uyumlu.

---

### 13. Etkinlik listesi / Bekleyen etkinlikler / Onaylama
- **API yok.** İstemci doğrudan Supabase kullanıyor.
- **RLS:**  
  - Public: `is_approved = true`.  
  - Organizer: `created_by_user_id = auth.uid()`.  
  - Admin: `user_roles.role = 'admin'`.  
  - Güncelleme: Sadece "Admins can update events" (043).
- **Durum:** RLS ile uyumlu.

---

## Özet

- **Rol:** Tüm hassas endpoint’lerde admin/organizer/controller kontrolü yapılıyor; `requireAdmin` / `requireRole` kullanılıyor.
- **RLS:** Service role kullanan API’ler RLS’i bypass ediyor; yetki API katmanında. İstemci Supabase çağrıları RLS politikalarına uyuyor.
- **Tablolar:** Her endpoint doğru tablolara yazıyor/okuyor (orders, events, tickets, user_roles vb.).
- **Hatalar:** 401/403/404/500 ve Türkçe mesajlar tutarlı şekilde kullanılıyor.
