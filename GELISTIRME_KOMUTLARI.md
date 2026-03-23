# Geliştirme Komutları Rehberi

Bu rehber, Bilet Ekosistemi projesinde sık kullanılan komutları açıklar. Her bölümde önce komutun ne yaptığı, sonra komutun kendisi yer alır.

---

## 1. Sunucu Başlatma

### Yerel geliştirme sunucusunu başlatır
Next.js uygulamasını `localhost` üzerinde çalıştırır. Değişiklikler otomatik yenilenir (hot reload). Varsayılan port 3000; doluysa 3001 kullanılır.

```bash
npm run dev
```

### Tarayıcıda açmak için
- `http://localhost:3000` veya
- `http://localhost:3001` (3000 doluysa)

---

## 2. Canlıya Alma (Deploy)

Proje **Vercel** üzerinde host edilir. GitHub’a push yaptığınızda Vercel otomatik deploy alır.

### Değişiklikleri canlıya almak için
Önce değişiklikleri commit edip GitHub’a push edersiniz. Push sonrası Vercel otomatik yeni deploy başlatır.

```bash
git add .
git commit -m "Yaptığınız değişikliğin kısa açıklaması"
git push origin main
```

### Manuel redeploy (Vercel Dashboard)
Cache temizleyerek yeniden build almak isterseniz:
1. [vercel.com](https://vercel.com) → Projenizi seçin
2. **Deployments** → En son deployment’ın yanındaki **⋮** (üç nokta)
3. **Redeploy** → **Redeploy** butonuna tıklayın

---

## 3. Git İşlemleri

### Değişikliklerin durumunu görmek
Hangi dosyaların değiştiğini, commit edilip edilmediğini listeler.

```bash
git status
```

### Tüm değişiklikleri stage’e eklemek
Commit öncesi değişiklikleri “hazır” hale getirir.

```bash
git add .
```

### Belirli dosyayı stage’e eklemek
Sadece seçtiğiniz dosyayı commit’e dahil eder.

```bash
git add dosya-yolu
```

### Commit oluşturmak
Stage’deki değişiklikleri yerel depoda kaydeder. Mesaj kısa ve açıklayıcı olmalıdır.

```bash
git commit -m "Mesajınız"
```

### GitHub’a göndermek
Yerel commit’leri uzak depoya (origin) gönderir. `main` branch’ine push yapıldığında Vercel deploy tetiklenir.

```bash
git push origin main
```

### Son commit’leri görmek
Son yapılan commit’lerin listesini gösterir.

```bash
git log --oneline -10
```

### Uzak depodan güncellemek
Başkalarının yaptığı değişiklikleri kendi bilgisayarınıza çeker.

```bash
git pull origin main
```

### Değişiklikleri geri almak (henüz commit edilmemişse)
Belirli bir dosyadaki değişiklikleri atar, dosyayı son commit haline döndürür.

```bash
git checkout -- dosya-yolu
```

### Son commit’i geri almak (değişiklikler kalır)
Son commit’i iptal eder; değişiklikler working directory’de kalır.

```bash
git reset --soft HEAD~1
```

---

## 4. Build ve Kontrol

### Production build almak
Projeyi production için derler. Hata varsa build sırasında görünür.

```bash
npm run build
```

### Lint ve build kontrolü
Hem ESLint hem de build çalıştırır; hata varsa gösterir.

```bash
npm run check
```

### Production modunda yerel çalıştırmak
Build aldıktan sonra production modunda `localhost` üzerinde çalıştırır.

```bash
npm run build
npm run start
```

---

## 5. Özet Tablo

| İşlem | Komut |
|-------|-------|
| Sunucu başlat | `npm run dev` |
| Değişiklikleri canlıya al | `git add .` → `git commit -m "..."` → `git push origin main` |
| Durum kontrolü | `git status` |
| Uzak depodan güncelle | `git pull origin main` |
| Build al | `npm run build` |
| Lint + build kontrol | `npm run check` |
| Duisburg SVG coords + plaka etiketleri | `npm run seatplan:refresh-duisburg-visual` |

---

## 6. Theater Duisburg salon planı (SVG)

`public/seatplans/theaterduisburg.svg` güncellendiğinde veya koltuk hizası/etiketleri değiştiğinde:

| Amaç | Komut |
|------|--------|
| SVG’den koordinat üret | `npm run seatplan:build-duisburg-coords` |
| `theaterduisburg-seat-display-labels.json` → TS etiket dosyası | `npm run seatplan:duisburg-section-labels` |
| İkisini ardışık | `npm run seatplan:refresh-duisburg-visual` |
| Etiketleri transcript’ten JSON’a dök (isteğe bağlı) | `npm run seatplan:dump-duisburg-labels` |

Detay: `public/seatplans/README.md`.

---

## 7. Supabase performans (DB + Storage)

### Indexler
En çok sorgulanan kolonlara index eklendi (migration `056_tickets_and_events_list_indexes.sql` ve `039_performance_indexes.sql`):
- `tickets(event_id)` — etkinlik detay / satın alma
- `events(is_active, created_at)` — ana sayfa listesi
- `events(date, time)` — takvim / şehir sayfası
- `orders(created_at, event_id, user_id, buyer_email)` — sipariş listeleri

Migration’ları uygulamak için Supabase Dashboard → SQL Editor veya `supabase db push`.

### Sayfalama (limit)
- Ana sayfa etkinlik listesi: **50** kayıt ile sınırlandı.
- Şehir sayfası etkinlik listesi: **300** kayıt ile sınırlandı.
- Daha fazla veri için API’de `range(offset, offset+pageSize)` kullanılabilir.

### Storage + CDN (etkinlik afişleri)
Etkinlik afişleri ve diğer Storage görselleri isteğe bağlı CDN üzerinden sunulabilir:

1. Supabase Dashboard → Project Settings → Storage’ta CDN’i etkinleştirin veya kendi CDN domain’inizi kullanın.
2. Ortam değişkeni ekleyin:
   ```bash
   NEXT_PUBLIC_STORAGE_CDN_URL=https://cdn-sizin-domain.com
   ```
3. Uygulama `getStorageImageUrl()` ile Storage URL’lerini bu domain’e yönlendirir; görseller daha hızlı yüklenir.
