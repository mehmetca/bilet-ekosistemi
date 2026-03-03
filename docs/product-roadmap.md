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
- Kritik admin islemleri icin denetim kaydi (audit log) tut.
- Hata izleme ve alarmlama ekle (ornek: Sentry).

## Teknik Temizlik Backlog'u

- Route ve tablo sorumluluklarini net tut (yalnizca etkinlik veri modeli).
- API'lar icin daha guclu rate limiting ve suistimal korumasi ekle.
- Gorsel optimizasyon politikasini standartlastir (format, boyut limitleri).
- Etkinlik sayfalari icin SEO metadatasi ve yapisal veri (structured data) iyilestir.
