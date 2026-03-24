# Urun Yol Haritasi

## Faz 1 - Hizli Gelir Kazanclari

- Odeme adimlarini kisaltip tek akisli hale getir.
- Guven unsurlari ekle (guvenli odeme rozetleri, iade politikasi, canli stok yazisi).
- Etkinlik kesfini filtrelerle guclendir (sehir, tarih araligi, fiyat, kategori).
- Siralama secenekleri ekle (yaklasan, en ucuz, populer).
- Admin paneline "etkinligi kopyala" ozelligi ekle.

## Faz 2 - Operasyon ve Donusum

- Indirim/promosyon kodu sistemi ekle (kullanim limiti, tarih araligi).
- Satis fazlari ekle (erken donem, genel satis, kapida satis).
- Tukenmis etkinlikler icin bekleme listesi ve e-posta bildirimi ekle.
- Etkinlik SSS ve mekan bilgisi bloklari ekle (ulasim, giris kurallari).
- Etkinlik oncesi hatirlatici ekle (once e-posta, sonra istege bagli SMS).

## Faz 3 - Analitik ve Olcekleme

- Admin KPI paneli olustur (gunluk satis, donusum, iade oranlari).
- Huni analitigi ekle (goruntuleme -> odeme -> satin alma).
- Ana CTA ve hero alanlari icin A/B test altyapisi kur.
- [ ] Microsoft Clarity ekle (yalnizca production, `afterInteractive`, env ile ac/kapat; KVKK/GDPR metinlerini guncelle).
- Kritik admin islemleri icin denetim kaydi (audit log) tut.
- Hata izleme ve alarmlama ekle (ornek: Sentry).

## Backlog - Kapı kontrolü ve internet kesintisi (ileride)

Mevcut `/kontrol` akışı Supabase üzerinden **çevrimiçi** çalışıyor; salon ve çevrede internet kesilirse anlık QR doğrulama yapılamaz. Şimdilik operasyonel yedek (mobil veri, ikinci cihaz, manuel liste) ile idare; ürün tarafında ileride değerlendirilecekler:

- [ ] **Operasyon kılavuzu:** Kapı günü yedek bağlantı (4G/5G, taşınabilir modem), çoklu cihaz/operatör ve manuel yedek liste prosedürünü `docs/` altında kısa bir rehbere yaz.
- [ ] **Offline / yarı-offline MVP:** Etkinlik bazlı bilet kodu listesinin kapı cihazına indirilmesi, okutmada cihaz içi doğrulama ve ağ gelince **senkron** (çift kullanım, `is_validated` tutarlılığı).
- [ ] **İmzalı QR (opsiyonel):** QR payload’ında etkinlik + süre + imza; offline’da “bu biletin bu gösteriye ait olduğu” doğrulanır; kullanılmışlık için yine senkron veya önbellek stratejisi gerekir.
- [ ] PWA / Service Worker ile offline kapı deneyimi (bugün SW bilinçli kapalı; tasarım ve güvenlik ayrı iş kalemi).

## Teknik Temizlik Backlog'u

- [x] Gorsel optimizasyon politikasini standartlastir (format, boyut limitleri).
- [x] Etkinlik sayfalari icin SEO metadatasi ve yapisal veri (structured data) iyilestir.
- [x] Debug console.log temizligi (production).
- [ ] Route ve tablo sorumluluklarini net tut (yalnizca etkinlik veri modeli).
- [ ] API'lar icin rate limiting (trafik artinca).
