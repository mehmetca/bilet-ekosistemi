# Local ile canlı neden farklı?

## 1. Farklı veritabanı (en sık neden)

- **Local:** `.env.local` içindeki `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ile **bir** Supabase projesine bağlanıyorsunuz.
- **Canlı (Vercel):** Vercel → Project → Settings → Environment Variables’ta tanımlı aynı değişkenler **başka** bir Supabase projesine işaret edebilir.

Sonuç: Etkinlikler, öne çıkanlar, haberler, şehirler canlıda farklı çünkü **farklı veritabanı**ndan geliyor.

**Ne yapmalı:**  
Canlıda kullanmak istediğiniz Supabase projesinin URL ve anon key’ini Vercel env’e yazın. Local’de test için ayrı bir proje kullanıyorsanız, local ile canlının farklı görünmesi normaldir; canlıda “production” Supabase’i kullanın.

---

## 2. Son kod canlıda yok

- Deploy, eski bir commit’ten yapılmış olabilir.
- Ya da push yapılmadan deploy tetiklenmiş olabilir.

**Ne yapmalı:**  
Tüm değişiklikleri commit edip `main` (veya Vercel’in bağlı olduğu branch) branch’ine push edin. Vercel otomatik deploy eder.  
Vercel dashboard → Deployments’ta “Source” / commit mesajına bakarak hangi commit’in canlıda olduğunu kontrol edin.

---

## 3. Önbellek (cache)

- Tarayıcı veya Vercel CDN eski sayfayı gösterebilir.

**Ne yapmalı:**  
- Tarayıcı: Ctrl+Shift+R (hard refresh) veya gizli pencerede açın.  
- Vercel: Deployments’ta son deployment’ta “Redeploy” (aynı commit’i tekrar deploy) yapın; bazen cache’i atlatır.

---

## 4. Ortam değişkenleri eksik / yanlış (canlıda)

Canlıda şunlar mutlaka tanımlı olmalı (Vercel → Settings → Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Bilet / e-posta / admin için ayrıca:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `TICKET_EMAIL_FROM` (e-posta için)

Eksik veya yanlışsa sayfa hata verebilir veya farklı davranabilir.

---

## Hızlı kontrol listesi

| Kontrol | Local | Canlı |
|--------|--------|--------|
| Hangi Supabase? | .env.local → NEXT_PUBLIC_SUPABASE_URL | Vercel env → aynı URL mi? |
| Son kod? | — | Son commit push edildi mi? Hangi commit deploy’da? |
| Cache? | — | Hard refresh / Redeploy denendi mi? |

Özet: **Veri farkı** çoğunlukla farklı Supabase (farklı DB); **görünüm/kod farkı** çoğunlukla son kodun deploy edilmemiş olması veya cache’tir.
