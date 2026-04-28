# Vercel'de İçerik Boş Geliyorsa (Etkinlik, Mekan, Sanatçı Yok)

Site Vercel'de açılıyor ama **"Hiç etkinlik yok"**, **"Hiç mekan yok"**, **"Hiç sanatçı kaydı yok"** mesajları görüyorsanız aşağıdakileri kontrol edin.

---

## 1. Vercel Environment Variables (En sık neden)

Vercel → Proje → **Settings** → **Environment Variables** bölümünde şunlar **mutlaka** tanımlı olmalı:

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'iniz (örn. `https://xxxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (API'ler için) |

**Önemli:**
- `NEXT_PUBLIC_` ile başlayanlar **build sırasında** koda gömülür. Eksikse client Supabase'e bağlanamaz.
- Değişken ekledikten sonra **Redeploy** yapın (Deployments → son deploy → ⋮ → Redeploy).

**Nereden alınır:** Supabase Dashboard → **Settings** → **API** → Project URL, anon key, service_role key.

---

## 2. Supabase RLS (Row Level Security)

`events`, `artists`, `news` tablolarında RLS açıksa ve "herkes okuyabilsin" policy'si yoksa, anon kullanıcı boş sonuç alır.

**Çözüm:** Migration `035_public_read_events_artists_news.sql` dosyasını Supabase'de çalıştırın:

1. Supabase Dashboard → **SQL Editor**
2. `supabase/migrations/035_public_read_events_artists_news.sql` içeriğini yapıştırın
3. **Run** tıklayın

Veya terminalde:
```bash
npx supabase db push
```

---

## 3. Aynı Supabase Projesi mi?

Local'de `.env.local` ile kullandığınız Supabase projesi ile Vercel'deki `NEXT_PUBLIC_SUPABASE_URL` **aynı** olmalı. Farklı proje = farklı veritabanı = boş tablolar.

---

## 4. Veritabanında Veri Var mı?

Supabase → **Table Editor** → `events`, `venues`, `artists`, `news` tablolarına bakın. Kayıt yoksa site boş görünür. Yönetim panelinden (`/yonetim`) etkinlik, mekan, sanatçı ekleyebilirsiniz.

---

## Özet Kontrol Listesi

- [ ] Vercel'de `NEXT_PUBLIC_SUPABASE_URL` tanımlı
- [ ] Vercel'de `NEXT_PUBLIC_SUPABASE_ANON_KEY` tanımlı
- [ ] Vercel'de `SUPABASE_SERVICE_ROLE_KEY` tanımlı
- [ ] Migration 035 çalıştırıldı (RLS policy)
- [ ] Supabase tablolarında veri var
- [ ] Env değişkeni ekledikten sonra Redeploy yapıldı
