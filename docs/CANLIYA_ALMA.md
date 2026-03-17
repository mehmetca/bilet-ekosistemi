# Bilet Ekosistemi – Canlıya Alma (Deploy)

Proje **Vercel** ile canlıya alınacak şekilde yapılandırılmıştır. Aşağıdaki adımları izleyin.

---

## 1. Ön koşullar

- Proje **Git** ile versiyonlanıyor olmalı (GitHub, GitLab veya Bitbucket).
- **Supabase** projeniz hazır; URL, anon key ve service role key elinizde.
- **Resend** (veya e-posta servisi) API key’i bilet e-postası için.

---

## 2. Vercel’e projeyi bağlama

1. [vercel.com](https://vercel.com) adresine gidin ve giriş yapın (veya hesap oluşturun).
2. **Add New** → **Project**.
3. **Import Git Repository** ile projenizin bulunduğu repoyu seçin (GitHub/GitLab/Bitbucket bağlı değilse önce bağlayın).
4. **Import** ile devam edin.
5. **Framework Preset:** Next.js otomatik seçilir.
6. **Root Directory:** boş bırakın (proje kökü).
7. **Build Command:** `npm run build` (varsayılan).
8. **Output Directory:** varsayılan (Next.js için boş).
9. **Install Command:** `npm install` (varsayılan).

---

## 3. Ortam değişkenleri (Environment Variables)

Vercel proje ayarlarında **Settings → Environment Variables** bölümüne gidin. Aşağıdaki değişkenleri **Production**, **Preview** ve (isterseniz) **Development** için ekleyin.

| Değişken | Açıklama | Zorunlu |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL’si | Evet |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | Evet |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Evet |
| `RESEND_API_KEY` | Resend API key (bilet e-postası) | Evet |
| `TICKET_EMAIL_FROM` | Gönderici e-posta (örn. `Bilet Ekosistemi <noreply@domain.com>`) | Evet |
| `NEXT_PUBLIC_SITE_URL` | Canlı site adresi (örn. `https://bilet.example.com`) | Önerilir (SEO, e-posta linkleri) |
| `CRON_SECRET` | Cron endpoint güvenliği (en az 16 karakter; hatırlatma mailleri) | Önerilir |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (hata izleme) | Opsiyonel |
| `SENTRY_ORG` | Sentry org slug | Sentry kullanıyorsanız |
| `SENTRY_PROJECT` | Sentry project slug | Sentry kullanıyorsanız |

**Not:** `NEXT_PUBLIC_*` değişkenleri değişince projeyi yeniden build etmek gerekir (yeni deploy tetikleyin).

---

## 4. İlk deploy

1. Ortam değişkenlerini kaydettikten sonra **Deployments** sekmesine gidin.
2. **Redeploy** veya yeni bir **git push** ile deploy tetikleyin.
3. Build tamamlanınca Vercel size bir URL verir (örn. `bilet-ekosistemi.vercel.app`).

---

## 5. Cron (hatırlatma mailleri)

Projede `vercel.json` içinde tanımlı cron vardır:

- **Path:** `/api/cron/send-reminders`
- **Schedule:** Her gün 09:00 (UTC)

Cron’un çalışması için Vercel’de projenin **Cron Jobs** özelliğinin açık olması ve `CRON_SECRET` ile isteklerin güvenli yapılması gerekir. İsterseniz [Vercel Cron](https://vercel.com/docs/cron-jobs) dokümantasyonuna bakın.

---

## 6. Özel domain (opsiyonel)

1. Vercel’de projeye girin → **Settings → Domains**.
2. Domain ekleyin (örn. `bilet.example.com`).
3. DNS’te Vercel’in verdiği kayıtları (A veya CNAME) ekleyin.
4. Ortam değişkenlerinde `NEXT_PUBLIC_SITE_URL` değerini bu domain ile güncelleyin ve yeniden deploy alın.

---

## 7. Build’i yerelde deneme

Canlıya almadan önce yerelde production build alıp test etmek için:

```bash
npm run build
npm run start
```

Tarayıcıda `http://localhost:3000` açarak kontrol edin.

---

## 8. Canlıda değişiklikler yansımıyorsa

**Kod ile veri farklıdır.** Aşağıdaki noktaları kontrol edin.

### Kod ve çeviriler (i18n)

- Yaptığınız sayfa ve metin değişiklikleri **Git’e commit + push** edildiyse ve Vercel **doğru branch**’ten (genelde `main`) build alıyorsa canlıda görünür.
- Yansımıyorsa: Vercel’de **Redeploy** (cache’siz) yapın; tarayıcıda **Ctrl+Shift+R** (hard refresh) deneyin.
- i18n (`messages/tr.json`, `en.json`, `de.json`) dosyaları da repoda olduğu için deploy ile birlikte güncellenir.

### Mekanlar listesi / yönetim paneli verileri

- Mekanlar, etkinlikler, kullanıcılar vb. **Supabase veritabanında** tutulur. Canlı site hangi Supabase’e bağlıysa (ortam değişkenleri) o veritabanındaki veriler görünür.
- **Yerelde** farklı bir Supabase (veya farklı proje) kullanıyorsanız, canlıda o veriler olmaz. Çözüm: Canlı ortamda **aynı Supabase projesini** kullanın veya gerekli verileri production veritabanına taşıyın.
- Vercel’deki `NEXT_PUBLIC_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` değerlerinin production Supabase’e ait olduğundan emin olun.

### Salon Tasarım Vizörü

- Vizördeki plan artık **sunucuda** da saklanıyor (`site_settings` tablosu, `salon_tasarim_vizor_plan` anahtarı).
- Yönetim panelinde **Kaydet** dediğinizde plan hem tarayıcıda hem (admin iseniz) sunucuda yazılır; canlıda sayfayı açtığınızda önce sunucudaki plan yüklenir, yoksa tarayıcıdaki kullanılır.
- Canlıda plan boşsa: Önce yerelde veya canlıda giriş yapıp **Kaydet**’e basın; sonra canlıda sayfayı yenileyin.

### Özet kontrol listesi (yansımama)

- [ ] Değişiklikler commit + push edildi ve Vercel doğru branch’ten deploy alıyor
- [ ] Gerekirse Vercel’de **Redeploy** (Clear cache) yapıldı
- [ ] Canlı ortam aynı Supabase projesine bağlı (mekanlar/etkinlikler için)
- [ ] Salon Vizör planı için en az bir kez **Kaydet** ile sunucuya yazıldı
- [ ] Tarayıcıda hard refresh (Ctrl+Shift+R) denendi

---

## Kısa kontrol listesi

- [ ] Repo Vercel’e bağlandı
- [ ] Tüm zorunlu ortam değişkenleri eklendi
- [ ] İlk deploy başarılı
- [ ] Supabase RLS ve API’ler canlı URL ile uyumlu (gerekirse Supabase’de site URL’i ekleyin)
- [ ] Bilet e-postası test edildi (opsiyonel)
- [ ] Özel domain eklendi (isterseniz)

Bu adımlarla site canlıya alınmış olur. Sorun olursa Vercel deploy log’larına ve Supabase log’larına bakın.
