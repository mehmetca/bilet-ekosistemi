# Projeyi GitHub'a Atma ve Üzerinde Çalışma

## 1. GitHub'da repo oluşturma

1. [github.com](https://github.com) → giriş yapın.
2. Sağ üst **+** → **New repository**.
3. **Repository name:** `bilet-ekosistemi` (veya istediğiniz isim).
4. **Public** seçin.
5. **"Add a README file"** işaretlemeyin (zaten projede var).
6. **Create repository** tıklayın.
7. Açılan sayfada **HTTPS** linkini kopyalayın, örn:  
   `https://github.com/KULLANICI_ADINIZ/bilet-ekosistemi.git`

---

## 2. Projeyi ilk kez GitHub'a atmak

Proje klasöründe **PowerShell** veya **Terminal** açın (`c:\bilet-ekosistemi`), sırayla:

```powershell
# Git henüz başlatılmadıysa
git init

# GitHub'dan kopyaladığınız linki buraya yapıştırın (KULLANICI_ADINIZ kısmını kendi kullanıcı adınızla değiştirin)
git remote add origin https://github.com/KULLANICI_ADINIZ/bilet-ekosistemi.git

# Tüm dosyaları ekle
git add .

# İlk commit
git commit -m "İlk commit: Next.js bilet ekosistemi"

# Ana dalı main yap (gerekirse)
git branch -M main

# GitHub'a gönder
git push -u origin main
```

İlk `git push` sırasında tarayıcı veya terminalde GitHub girişi istenebilir; giriş yapın.

---

## 3. Günlük çalışma (değişiklik yaptıkça)

Başka bilgisayarda veya ekip arkadaşı değişiklik yaptıysa önce çekin:

```powershell
git pull
```

Sonra siz değişiklik yapın. Bitince:

```powershell
git add .
git commit -m "Kısa açıklama: ne yaptınız"
git push
```

Sadece siz çalışıyorsanız `git pull` her seferinde şart değil; yine de günde bir kez çekmek iyi olur.

---

## 4. Başka bilgisayarda projeyi açmak

O bilgisayarda:

```powershell
git clone https://github.com/KULLANICI_ADINIZ/bilet-ekosistemi.git
cd bilet-ekosistemi
npm install
```

Sonra `.env.local` dosyasını o bilgisayarda elle oluşturup Supabase/Resend vb. değerleri yazın (bu dosya GitHub'a gitmez).

---

## Özet komutlar

| Ne yapıyorsunuz?        | Komutlar                                      |
|-------------------------|-----------------------------------------------|
| İlk kez GitHub'a atma   | `git init` → `remote add` → `add .` → `commit` → `push` |
| Değişiklikleri gönderme | `git add .` → `git commit -m "..."` → `git push` |
| Başkasının değişikliğini almak | `git pull`                            |
| Yeni bilgisayarda açmak | `git clone ...` → `npm install` → `.env.local` |

---

## 5. Siteyi dışarıdaki biri nasıl görür? (bilgisayarına hiçbir şey kurmadan)

**GitHub sadece kodu saklar** — site orada “çalışmaz”, sadece dosyalar durur. Birinin tarayıcıda siteyi görmesi için projeyi **canlı yayına (deploy)** almanız gerekir.

**En kolay yol: Vercel (ücretsiz)**

1. [vercel.com](https://vercel.com) → **Sign up** → **Continue with GitHub** ile GitHub hesabınızla giriş yapın.
2. **Add New** → **Project** → `mehmetca/bilet-ekosistemi` reposunu seçin → **Import**.
3. **Environment Variables** kısmında `.env.local` içindeki değişkenleri tek tek ekleyin (örn. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TICKET_EMAIL_FROM`, `RESEND_API_KEY` vb.).
4. **Deploy** tıklayın. Birkaç dakika sonra size bir link verilir, örn: `https://bilet-ekosistemi-xxx.vercel.app`.
5. Bu linki kime verirseniz, tarayıcıda açar; **hiçbir şey indirmesine veya kurmasına gerek yok**.

**Çalışma şekli:** Değişiklikleri **local’de** yapıp test edin, onayladıktan sonra `git add` → `git commit` → `git push` yapın. Push ettiğiniz anda Vercel **otomatik** yeni deploy alır; birkaç dakika sonra canlı site güncellenir. Yani “onay verdiğiniz” an push ettiğiniz andır.
