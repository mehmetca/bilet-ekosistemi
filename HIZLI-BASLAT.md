# Sayfa Takılması / Yavaşlık Çözümü

## PowerShell Hatası (SQL yapıştırma)
**SQL migration dosyalarını PowerShell'de ÇALIŞTIRMAYIN.** SQL Supabase Dashboard → SQL Editor'da çalıştırılmalı. PowerShell sadece komut satırı (npm, node vb.) içindir.

## Sayfa Takılıyorsa / Çok Yavaşsa

### 1. Eski dev server'ı kapatın
- `Ctrl+C` ile çalışan `npm run dev`'i durdurun
- Eğer port 3000 kullanımda uyarısı alıyorsanız, birden fazla Node süreci çalışıyor olabilir

### 2. Temiz başlatma (önerilen)
```powershell
npm run dev:clean
```
Bu komut `.next` klasörünü siler ve Turbopack ile dev server'ı başlatır. Chunk hataları (MODULE_NOT_FOUND, 404) genelde bozuk cache'den kaynaklanır.

### 3. Manuel temizlik
```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev:turbo
```

### 4. Turbopack nedir?
`npm run dev:turbo` veya `npm run dev:clean` — Next.js'in yeni Rust tabanlı bundler'ı. Sayfa geçişleri çok daha hızlıdır.
