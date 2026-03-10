# Canlıya alma ve geri dönüş

## Canlıya almadan önce

1. **Yerel test:** `npm run build` ve `npm run start` ile projeyi çalıştırıp ana sayfa, etkinlik listesi, filtre ve öne çıkan etkinlikleri kontrol edin.
2. **Tag / yedek:** Canlıya alacağınız commit’i tag’leyin; sorun olursa bu noktaya dönebilirsiniz:
   ```bash
   git tag canli-2025-03-07
   git push origin canli-2025-03-07
   ```

## Canlıya alma (kontrollü)

- Hosting’inize göre (Vercel, Netlify, kendi sunucu vb.) normal deploy adımlarınızı uygulayın.
- Mümkünse önce **staging / önizleme** ortamına alıp bir kez orada test edin, sonra production’a alın.

## Geri dönüş (rollback)

**Yöntem 1 – Önceki tag’e dönmek**
```bash
git checkout canli-2025-03-07
# Ardından projeyi bu commit ile yeniden deploy edin.
```

**Yöntem 2 – Son commit’i geri almak**
```bash
git revert HEAD --no-edit
git push origin main
# Deploy tetiklenir; bir önceki hali canlıya gider.
```

**Yöntem 3 – Hosting paneli**  
Vercel/Netlify vb. kullanıyorsanız, panelden önceki bir deployment’ı “Promote to production” ile tekrar canlıya alabilirsiniz.

---

*Şehir filtresi: Aynı şehir farklı yazımlarla (Berlin, Berlin Germany, berlin) artık tek seçenekte toplanıyor; tekrarlar kaldırıldı.*
