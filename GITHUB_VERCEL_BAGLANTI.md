# GitHub – Vercel Bağlantısı (Adım Adım)

---

## BÖLÜM 1: GitHub Webhook Temizliği

### 1.1 GitHub reposuna girin
- Tarayıcıda **https://github.com/mehmetca/bilet-ekosistemi** adresini açın
- Giriş yapmadıysanız GitHub hesabınızla giriş yapın

### 1.2 Settings sayfasına gidin
- Repo sayfasında üst menüden **Settings** sekmesine tıklayın
- (Code, Issues, Pull requests gibi sekmelerin yanında)

### 1.3 Webhooks bölümüne gidin
- Sol menüden **Webhooks** seçeneğine tıklayın
- (Integrations altında Webhooks yazıyor)

### 1.4 Vercel webhook'unu silin (varsa)
- Listede **Payload URL** sütununda `api.vercel.com` geçen webhook var mı bakın
- **Varsa:** O satıra tıklayın → Sayfanın en altına inin → **Delete webhook** butonuna tıklayın → Onaylayın
- **Yoksa:** Bu adımı atlayın, devam edin

---

## BÖLÜM 2: Vercel Projelerini Temizleme

### 2.1 Vercel'e girin
- Tarayıcıda **https://vercel.com** adresini açın
- Giriş yapın
- Dashboard'da projelerinizi görürsünüz

### 2.2 bilet-ekosistemi-hfy7 projesini silin
- Proje listesinde **bilet-ekosistemi-hfy7** projesine tıklayın
- Üst menüden **Settings** sekmesine tıklayın
- Sayfayı en alta kaydırın
- **Delete Project** bölümünü bulun
- **Delete** butonuna tıklayın
- Açılan pencerede proje adını **bilet-ekosistemi-hfy7** olarak yazın
- **Confirm** veya **Delete** butonuna tıklayın

### 2.3 bilet-ekosistemi projesinden Git bağlantısını kesin
- **Dashboard**'a dönün (sol üstteki Vercel logosuna tıklayın)
- **bilet-ekosistemi** projesine tıklayın
- Üst menüden **Settings** sekmesine tıklayın
- Sol menüden **Git** seçeneğine tıklayın
- **Connected Git Repository** bölümünde **Disconnect** veya **Disconnect Repository** butonuna tıklayın
- Onay penceresinde **Disconnect** ile onaylayın
- (Projeyi silmiyorsunuz, sadece GitHub bağlantısını kaldırıyorsunuz)

---

## BÖLÜM 3: GitHub'dan Yeni Proje Oluşturma

### 3.1 Yeni proje ekleme ekranını açın
- Vercel Dashboard'da sağ üstteki **Add New...** butonuna tıklayın
- Açılan menüden **Project** seçeneğine tıklayın

### 3.2 GitHub reposunu seçin
- **Import Git Repository** bölümünde **GitHub** sekmesinin seçili olduğundan emin olun
- **Search repositories** kutusuna `bilet-ekosistemi` yazın
- Listede **mehmetca/bilet-ekosistemi** reposunu bulun
- **Import** butonuna tıklayın

### 3.3 Proje ayarları ekranı
- **Configure Project** sayfası açılacak
- **Project Name:** `bilet-ekosistemi` yazın (veya istediğiniz isim)
- **Framework Preset:** Next.js (otomatik seçili olmalı)
- **Root Directory:** boş bırakın
- **Build and Output Settings:** varsayılan değerleri bırakın (Build Command: `npm run build`)

---

## BÖLÜM 4: Environment Variables Ekleme

### 4.1 Environment Variables bölümünü açın
- Aynı sayfada **Environment Variables** bölümüne inin
- **Add** veya **Add New** butonuna tıklayın

### 4.2 Supabase değişkenlerini ekleyin

**1. değişken:**
- **Key:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** `https://xxxxx.supabase.co` (Supabase proje URL'iniz – .env.local'dan kopyalayın)
- **Environment:** Production, Preview, Development seçin (✓ işaretleyin)
- **Add** veya **Save** tıklayın

**2. değişken:**
- **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** Supabase anon key (uzun bir string – .env.local'dan kopyalayın)
- **Environment:** Production, Preview, Development seçin
- **Add** veya **Save** tıklayın

**3. değişken:**
- **Key:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** Supabase service_role key (uzun bir string – .env.local'dan kopyalayın)
- **Environment:** Production, Preview, Development seçin
- **Add** veya **Save** tıklayın

**Supabase değerlerini nereden alırsınız:** supabase.com → Projeniz → **Settings** → **API** → Project URL, anon key, service_role key

### 4.3 (Opsiyonel) E-posta değişkenleri
- **RESEND_API_KEY** ve **TICKET_EMAIL_FROM** varsa .env.local'dan ekleyin

---

## BÖLÜM 5: Deploy Başlatma

### 5.1 Deploy
- Sayfanın altındaki **Deploy** butonuna tıklayın
- Build başlayacak (1–3 dakika sürebilir)

### 5.2 Build tamamlanmasını bekleyin
- **Building** yazısı **Ready** olana kadar bekleyin
- Yeşil tik görünce deploy tamamlanmıştır

### 5.3 Siteyi kontrol edin
- **Visit** butonuna tıklayın veya `https://bilet-ekosistemi.vercel.app` adresini açın
- Etkinlikler ve haberler görünüyorsa başarılı

---

## BÖLÜM 6: Eski Projeyi Silme (İsteğe Bağlı)

Yeni proje çalışıyorsa, Git bağlantısı kesilmiş eski **bilet-ekosistemi** projesini silebilirsiniz:

- Dashboard → **bilet-ekosistemi** (eski proje) → **Settings** → en alta in → **Delete Project**
- **Not:** Yeni import ettiğiniz proje de `bilet-ekosistemi` adıyla oluştuysa, isim çakışması olabilir. Vercel yeni projeye `bilet-ekosistemi-xxx` gibi bir isim vermiş olabilir. En güncel deploy alan projeyi kullanın.

---

## Sorun Giderme

**İçerik boş geliyorsa:**
- Vercel → Proje → **Settings** → **Environment Variables** → Değerlerin doğru olduğundan emin olun
- Supabase SQL Editor'da `035_public_read_events_artists_news.sql` migration'ını çalıştırın
- **Redeploy** yapın (Deployments → ⋮ → Redeploy → Clear cache)
