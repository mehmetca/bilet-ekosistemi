# Çok Dilli İçerik Kılavuzu

Bu dokümanda veritabanı ve admin panelinde çok dilli içerik (TR, DE, EN) kullanımı adım adım açıklanır.

---

## Adım 1: Migration'ı Çalıştırın

Supabase Dashboard → SQL Editor'e gidin ve `supabase/migrations/033_add_i18n_content.sql` dosyasının içeriğini yapıştırıp çalıştırın.

Veya proje kökünden:

```bash
npx supabase db push
# veya
npx supabase migration up
```

Bu migration şunları ekler:
- **events**: title_tr, title_de, title_en, description_tr/de/en, venue_tr/de/en
- **venues**: name, address, city, seating_layout_description, transport_info, entrance_info, rules için _tr, _de, _en kolonları
- **artists**: name_tr/de/en, bio_tr/de/en
- **news**: title_tr/de/en, content_tr/de/en, excerpt_tr/de/en

Mevcut veriler otomatik olarak _tr kolonlarına kopyalanır.

---

## Adım 2: Admin Panelinde İçerik Girişi

### Etkinlikler (Yönetim → Etkinlikler)

Yeni etkinlik eklerken veya düzenlerken:

1. **Türkçe** sekmesi: Etkinlik Adı, Açıklama, Mekan Adı (TR)
2. **Deutsch** sekmesi: Etkinlik Adı, Açıklama, Mekan Adı (DE)
3. **English** sekmesi: Etkinlik Adı, Açıklama, Mekan Adı (EN)

- En az **Türkçe** alanları doldurulmalıdır (zorunlu).
- DE ve EN boş bırakılırsa, frontend TR'ye fallback yapar.

### Mekanlar (Yönetim → Mekanlar)

Yeni mekan eklerken veya düzenlerken:

- **Mekan Adı**: TR (zorunlu), DE, EN
- **Adres & Şehir**: TR, DE, EN
- **Oturma Düzeni Açıklaması**: TR, DE, EN
- **Giriş Bilgileri**: TR, DE, EN
- **Ulaşım Bilgisi**: TR, DE, EN (RichText)
- **Giriş Kuralları**: TR, DE, EN

### Sanatçılar (Yönetim → Sanatçılar)

- **Sanatçı Adı**: TR (zorunlu), DE, EN
- **Biyografi / Özgeçmiş**: TR (zorunlu), DE, EN (her dil için ayrı MDEditor)

### Haberler (Yönetim → Haberler)

- **Başlık**: TR (zorunlu), DE, EN
- **Özet**: TR, DE, EN
- **İçerik**: TR (zorunlu), DE, EN (her dil için ayrı MDEditor)

---

## Adım 3: Frontend Davranışı

Kullanıcı `/tr`, `/de` veya `/en` sayfasındayken:

- Etkinlik başlığı: `title_tr`, `title_de`, `title_en` → seçilen dile göre
- Açıklama, mekan adı: aynı mantık
- Fallback: İlgili dil yoksa → TR → DE → EN → orijinal alan

---

## Örnek: "Rojda Konseri" Eklemek

1. Yönetim → Etkinlikler → Yeni Etkinlik
2. **Türkçe**:
   - Etkinlik Adı: `Rojda Konseri`
   - Açıklama: `Rojda'nın unutulmaz performansı...`
   - Mekan: `Jolly Joker İstanbul`
3. **Deutsch**:
   - Etkinlik Adı: `Rojda Konzert`
   - Açıklama: `Rojdas unvergessliche Performance...`
   - Mekan: `Jolly Joker Istanbul`
4. **English**:
   - Etkinlik Adı: `Rojda Concert`
   - Açıklama: `Rojda's unforgettable performance...`
   - Mekan: `Jolly Joker Istanbul`
5. Tarih, saat, kategori, fiyat vb. (ortak alanlar) tek seferde girilir.
6. Kaydet.

Sonuç:
- `/tr` → "Rojda Konseri"
- `/de` → "Rojda Konzert"
- `/en` → "Rojda Concert"

---

## Teknik Notlar

- `src/lib/i18n-content.ts`: `getLocalizedText`, `getLocalizedEvent`, `getLocalizedVenue`, `getLocalizedArtist`, `getLocalizedNews` helper fonksiyonları
- Orijinal `title`, `description`, `venue` kolonları geriye dönük uyumluluk için korunur; migration mevcut veriyi `_tr` kolonlarına kopyalar.
