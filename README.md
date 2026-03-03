# Bilet Ekosistemi

Etkinlik, sanatçı ve bilet satışı için Next.js uygulaması.

## Teknolojiler

- **Next.js 14** (React)
- **Supabase** (veritabanı, auth)
- **Tailwind CSS**
- **Resend** (bilet e-postası)

## Çalıştırma

```bash
npm install
npm run dev
```

`.env.local` içinde `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TICKET_EMAIL_FROM` tanımlı olmalı.

---

## Bu proje hakkında (unutmayın)

- **Bu klasör** = Bilet Ekosistemi’nin **Next.js (canlı) sürümü**.
- Veritabanı: Supabase. Yönetim paneli: `/yonetim`, giriş: `/giris`.
- İleride **WordPress sürümü** ayrı bir proje/klasör olacak; karıştırmamak için:
  - **Canlı site (Next.js)** → bu repo / bu klasör
  - **WordPress sürümü** → ayrı klasör veya ayrı repo

Yedekleme ve “hangi site nerede” notları için **YEDEKLEME.md** dosyasına bakın.
