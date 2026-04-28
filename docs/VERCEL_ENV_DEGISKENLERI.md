# Vercel Environment Variables – Eklenecek Değişkenler

**Yol:** Vercel → Projeniz → **Settings** → **Environment Variables**

---

## Eklenecek 3 Değişken

Her biri için **Add** veya **Add New** tıklayın, aşağıdaki bilgileri girin.

---

### 1. NEXT_PUBLIC_SUPABASE_URL

| Alan | Değer |
|------|-------|
| **Key** | `NEXT_PUBLIC_SUPABASE_URL` |
| **Value** | `https://dzncmwjffopednfgjwlo.supabase.co` |
| **Environments** | Production ✓, Preview ✓, Development ✓ |

---

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY

| Alan | Değer |
|------|-------|
| **Key** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Value** | `.env.local` dosyanızdan kopyalayın (eyJ ile başlayan uzun string) |
| **Environments** | Production ✓, Preview ✓, Development ✓ |

---

### 3. SUPABASE_SERVICE_ROLE_KEY

| Alan | Değer |
|------|-------|
| **Key** | `SUPABASE_SERVICE_ROLE_KEY` |
| **Value** | `.env.local` dosyanızdan kopyalayın (eyJ ile başlayan uzun string) |
| **Environments** | Production ✓, Preview ✓, Development ✓ |

---

## Değerleri Nereden Alacaksınız?

1. Proje klasöründe `.env.local` dosyasını açın
2. İlgili satırları bulun ve Value kısmını kopyalayın
3. Vercel’de ilgili değişkene yapıştırın

**Örnek .env.local:**
```
NEXT_PUBLIC_SUPABASE_URL=https://dzncmwjffopednfgjwlo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Ekledikten Sonra

1. **Save** ile kaydedin
2. **Deployments** → **Redeploy** (cache temiz) yapın
3. Build tamamlanana kadar bekleyin
