# Bilet Ekosistemi – Vercel’e Sıfırdan Kurulum

Bu rehber, projeyi sıfırdan Vercel’e deploy etmek için adım adım yazılmıştır.

---

# BÖLÜM A: HAZIRLIK (Bilgisayarınızda)

## Adım A1: .env.local dosyasını açın

1. Proje klasörünüzde `.env.local` dosyasını açın
2. Şu satırları bulun ve değerlerini not alın (veya kopyalayın):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

3. Bu 3 değeri bir yere kaydedin (sonraki adımda kullanacağız)

**Eğer .env.local yoksa:** Supabase Dashboard → Settings → API’den bu değerleri alın.

---

## Adım A2: GitHub’da kodun güncel olduğundan emin olun

1. Terminal veya PowerShell açın
2. Proje klasörüne gidin: `cd c:\bilet-ekosistemi`
3. Şu komutu çalıştırın: `git status`
4. "nothing to commit, working tree clean" görüyorsanız devam edin
5. Değişiklik varsa: `git add -A` sonra `git commit -m "Değişiklikler"` sonra `git push`

---

# BÖLÜM B: VERCEL’E GİRİŞ

## Adım B1: Vercel hesabına girin

1. Tarayıcıda **https://vercel.com** adresini açın
2. Giriş yapın (GitHub ile giriş yapıyorsanız, GitHub hesabınızla giriş yapın)

---

## Adım B2: Yeni proje oluşturun

1. Vercel ana sayfasında sağ üstte **Add New...** butonuna tıklayın
2. Açılan menüden **Project** seçeneğine tıklayın
3. **Import Git Repository** sayfası açılacak

---

## Adım B3: GitHub reposunu seçin

1. **GitHub** sekmesinin seçili olduğundan emin olun
2. Arama kutusuna `bilet-ekosistemi` yazın
3. Listede **mehmetca/bilet-ekosistemi** reposunu bulun
4. **Import** butonuna tıklayın

---

## Adım B4: Proje adını girin

1. **Configure Project** sayfası açılacak
2. **Project Name** kutusuna benzersiz bir isim yazın, örneğin:
   - `bilet-ekosistemi-app`
   - veya `biletsatis`
   - veya `bilet-ekosistemi-2026`
3. **Önemli:** Daha önce kullanılmış bir isim yazarsanız "already exists" hatası alırsınız. Farklı bir isim deneyin.

---

## Adım B5: Build ayarlarını kontrol edin

1. **Framework Preset:** Next.js (otomatik seçili olmalı)
2. **Root Directory:** boş bırakın
3. **Build Command:** `npm run build` (varsayılan)
4. **Output Directory:** `.next` (varsayılan)
5. **Install Command:** `npm install` (varsayılan)
6. Bu ayarları değiştirmeyin, varsayılan değerleri kullanın

---

# BÖLÜM C: ENVIRONMENT VARIABLES (ÖNEMLİ)

## Adım C1: Environment Variables bölümünü bulun

1. Aynı sayfada aşağı kaydırın
2. **Environment Variables** başlığını bulun
3. **Add** veya **Add New** butonuna tıklayın

---

## Adım C2: İlk değişkeni ekleyin

1. **Key** (veya Name) kutusuna yazın: `NEXT_PUBLIC_SUPABASE_URL`
2. **Value** kutusuna yazın: `https://dzncmwjffopednfgjwlo.supabase.co`
   - (Kendi Supabase URL’iniz farklıysa .env.local’daki değeri kullanın)
3. **Environment** kısmında 3 kutu da işaretli olsun: Production, Preview, Development
4. **Add** veya **Save** butonuna tıklayın

---

## Adım C3: İkinci değişkeni ekleyin

1. Tekrar **Add** tıklayın
2. **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Value:** .env.local’daki değeri yapıştırın (uzun bir string, `eyJ...` ile başlar)
4. **Environment:** 3 kutu da işaretli
5. **Add** tıklayın

---

## Adım C4: Üçüncü değişkeni ekleyin

1. Tekrar **Add** tıklayın
2. **Key:** `SUPABASE_SERVICE_ROLE_KEY`
3. **Value:** .env.local’daki değeri yapıştırın (uzun bir string)
4. **Environment:** 3 kutu da işaretli
5. **Add** tıklayın

---

## Adım C5: Değişkenleri kontrol edin

1. Listede şu 3 satırın göründüğünden emin olun:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY

---

# BÖLÜM D: DEPLOY

## Adım D1: Deploy’u başlatın

1. Sayfanın en altına inin
2. **Deploy** butonuna tıklayın
3. Build başlayacak

---

## Adım D2: Build’in tamamlanmasını bekleyin

1. **Building** yazısı görünecek
2. 2–5 dakika bekleyin
3. **Ready** yazısı ve yeşil tik görünce build tamamlanmıştır

---

## Adım D3: Siteyi açın

1. **Visit** butonuna tıklayın
2. Veya verilen URL’yi kopyalayıp tarayıcıda açın (örn: `https://bilet-ekosistemi-app.vercel.app`)

---

# BÖLÜM E: İÇERİK BOŞSA (Supabase RLS)

Eğer site açılıyor ama etkinlik/haber görünmüyorsa:

## Adım E1: Supabase SQL Editor’ı açın

1. **https://supabase.com** adresine gidin
2. Projenize girin (dzncmwjffopednfgjwlo)
3. Sol menüden **SQL Editor** seçin
4. **New query** tıklayın

---

## Adım E2: Migration’ı çalıştırın

1. Projenizde `supabase/migrations/035_public_read_events_artists_news.sql` dosyasını açın
2. İçeriğini kopyalayın
3. Supabase SQL Editor’a yapıştırın
4. **Run** butonuna tıklayın
5. "Success" mesajı görünmeli

---

## Adım E3: Vercel’de Redeploy yapın

1. Vercel Dashboard’a dönün
2. Projenize tıklayın
3. **Deployments** sekmesine girin
4. En üstteki (en son) deployment’ın yanındaki **⋮** (üç nokta) menüsüne tıklayın
5. **Redeploy** seçin
6. **Use existing Build Cache** kutusunu **işaretleyin** (veya kaldırın – temiz build için)
7. **Redeploy** butonuna tıklayın

---

## Adım E4: Siteyi tekrar kontrol edin

1. **Visit** ile siteyi açın
2. Etkinlikler ve haberler görünüyor olmalı

---

# ÖZET KONTROL LİSTESİ

- [ ] A1: .env.local dosyasına baktım, 3 değeri not aldım
- [ ] A2: GitHub’da kod güncel
- [ ] B1–B4: Vercel’e girdim, proje oluşturdum, GitHub’dan import ettim
- [ ] B5: Proje adı benzersiz
- [ ] C1–C5: 3 Environment Variable ekledim
- [ ] D1–D3: Deploy’u başlattım, tamamlandı, siteyi açtım
- [ ] E1–E4: İçerik boşsa RLS migration çalıştırdım, Redeploy yaptım

---

# SORUN GİDERME

**"Project already exists" hatası:** Farklı bir proje adı yazın (örn: bilet-ekosistemi-xxx)

**"Cron expression" hatası:** vercel.json güncel (günde 1 kez) – zaten düzeltildi

**İçerik boş:** Environment Variables doğru mu kontrol edin, RLS migration çalıştırın, Redeploy yapın

**Build hatası:** Vercel Dashboard → Deployments → Failed deployment’a tıklayın → Build Logs’a bakın
