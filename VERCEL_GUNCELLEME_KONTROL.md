# Vercel Güncelleme Sorunu – Kontrol Listesi

## ✅ Doğrulananlar

- **GitHub:** Son commit `3d85c84` repoda mevcut
- **Build:** `npm run build` yerelde sorunsuz tamamlanıyor
- **Remote:** `origin/main` ile senkron

---

## Vercel Tarafında Kontrol Edilecekler

### 1. Production Branch
Vercel → Proje → **Settings** → **Git** → **Production Branch**

- **Production Branch** değeri `main` olmalı.
- Farklıysa (örn. `master`, `production`) değiştirip kaydedin.

### 2. Deployment Durumu
Vercel → Proje → **Deployments**

- En son deployment **Ready** durumda mı?
- **Failed** ise: tıklayıp **Build Logs** bölümünden hata mesajını inceleyin.
- **Building** ise: build tamamlanana kadar bekleyin.

### 3. Manuel Redeploy
Vercel → Proje → **Deployments**

- En son deployment satırında **⋮** (üç nokta) menüsüne tıklayın.
- **Redeploy** seçin.
- **Redeploy** butonuna basın.
- **Use existing Build Cache** işaretini kaldırın (temiz build için).

### 4. GitHub Bağlantısı
Vercel → Proje → **Settings** → **Git**

- **Connected Git Repository** doğru repo adresini gösteriyor mu?  
  (`mehmetca/bilet-ekosistemi.git`)

### 5. Tarayıcı Önbelleği
- **Hard refresh:** `Ctrl+Shift+R` (Windows) veya `Cmd+Shift+R` (Mac)
- **Gizli/incognito:** Yeni pencerede tekrar deneyin
- **CDN:** Vercel CDN birkaç dakika gecikmeli güncelleyebilir

---

## Hızlı Test

1. Vercel Dashboard → Deployments → en son deployment’a tıklayın.
2. **Visit** URL’sini kopyalayın (örn. `https://bilet-ekosistemi-xxx.vercel.app`).
3. Bu URL’yi `?v=1` ile açın: `https://...vercel.app/?v=1`
4. Yeni deployment’da mobil menü varsa güncelleme gelmiş demektir.

---

## Özet

| Kontrol | Nerede |
|-----------|--------|
| Production Branch = main | Settings → Git |
| Son deployment Ready | Deployments |
| Redeploy (cache temiz) | Deployments → ⋮ → Redeploy |
| Hard refresh | Tarayıcı: Ctrl+Shift+R |
