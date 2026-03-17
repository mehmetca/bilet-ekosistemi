# Bilet Ekosistemi – Kurulum

## Gereksinimler

- Node.js 18+
- npm veya yarn

## Kurulum

```bash
npm install
```

Ortam değişkenleri için proje kökünde `.env.local` oluşturun:

```bash
cp .env.example .env.local
```

Gerekli değişkenler `.env.example` içinde listelenmiştir (Supabase URL/anon key/service role, Resend API key vb.).

## Çalıştırma

```bash
npm run dev
npm run build
npm run start
```

## Önemli ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (sunucu/admin) |
| `RESEND_API_KEY` | Bilet e-postası (Resend) |
| `TICKET_EMAIL_FROM` | Gönderici e-posta |

Tüm liste için `.env.example` dosyasına bakın.

## Çeviri anahtarları kontrolü

```bash
node scripts/check-i18n-keys.js
```

tr/en/de mesaj dosyalarında eksik veya fazla anahtarları raporlar.
