# Cloudflare Free Plan — Görsel CDN Uyarısı ve Kontrol Listesi

> Tarih: 2026-09-07
> Bağlam: Görseller `cdn.kurdevents.com` üzerinden dağıtılıyor. Bu, bir Cloudflare **Worker**
> (`muddy-paper-ab70`) üzerinden çalışır.

## Özet
- Cloudflare **Free plan'da CDN trafiği/bant genişliği SINIRSIZ ve ücretsizdir** (görsel cache'inden dağıtım sayılmaz).
- DNS, Universal SSL, proxy için ek ücret/limit yok.
- **Tek gerçek sınır: Workers — günde 100.000 istek** (Free plan).

## ⚠️ Workers limiti neden önemli
- Görseller `cdn.kurdevents.com`'a geldiğinde Worker çalışır ve **her istek** (cache HIT olsa bile) 100.000/gün kotasına sayılır.
- Mevcut mimaride tarayıcı → cdn doğrudan giden istekler azdır (çoğu görsel `next/image` ile VPS'te optimize edilir; Worker'a sadece cache dolarken isabet eder).
- Yine de şu durumlarda istek sayısı artar:
  - Sanatçı sayfasındaki **ham galeri küçük resimleri** (doğrudan cdn)
  - Etkinlik detay **galeri modalı**
  - Sepet/ödeme görselleri
  - **Viral/trafik patlaması** (büyük maç günü, kampanya)
  - Yoğun SEO bot taramaları

## Yapılacaklar / Kontrol Listesi
- [ ] **İzle:** Cloudflare → Workers & Pages → `muddy-paper-ab70` → **Metrics** — günlük istek sayısı.
- [ ] Ayda bir göz at; 100.000/gün'e yaklaşılıyorsa aksiyon al.
- [ ] Eşiğe yaklaşılırsa **2 seçenek**:
  1. **Origin Rule ile Host düzeltme** (ücretsizse) → Worker'ı kaldır, doğrudan CF cache kullan. (Origin Rules'te "Host header → Rewrite" ücretsiz değilse bu seçenek geçersiz.)
  2. **Workers Paid** (ayda ~$5) → istek limiti kalkar.
- [ ] Görseller artık doğrudan Supabase'den gelmiyor; Supabase egress'ine sadece cache boşaldığında isabet eder. **Egress'i 2-3 gün izle** (Supabase Dashboard → Cached egress).

## Alakalı mimari notlar
- Optimize görseller: `kurdevents.com/_next/image` → VPS (sharp) → orijinal `cdn.kurdevents.com` (Worker, CF cache).
- Kart görselleri `CoverImage` + `next/image` ile CDN + optimize edilir.
- Kalan doğrudan-cdn kullanımlar (yukarıda listelenen) düşük hacimlidir.

## Not
- Yeni görsel yüklemeleri otomatik sıkıştırılır (≤1600px, WebP) → hem Supabase depolama hem bant genişliği düşer.

---

## 🔔 HATIRLATMA — Kontrol edilecekler
- [ ] **2026-09-08 (yarın):** Workers `muddy-paper-ab70` → Metrics (günlük istek sayısı)
- [ ] **2026-09-09:** Supabase Dashboard → Usage → Cached egress (düştü mü/plato yaptı mı)
- [ ] İkisi de normal görünüyorsa hiçbir işlem gerekmez.
