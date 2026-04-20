# EventSeat – Etkinlik / Bilet sayfası: iki ana akış (özellik özeti)

EventSeat tarzı etkinlik sayfalarında yaygın olarak iki ana bilet alma yöntemi sunulur. Bizim sitede de bu iki seçenek hedeflenir:

---

## 1. İki ana seçenek

### A) Fiyat kategorisine göre bilet (best available / kategori seçimi)

- Müşteri **sadece fiyat kategorisini** seçer (örn. Kategori 1, Kategori 2, İndirimli).
- Sistem **otomatik olarak** o kategorideki “en iyi” uygun yeri atar (organizatörün tanımladığı önceliğe göre).
- **Bizde zaten var:** Bilet türü + fiyat + adet seçimi. Bu akış buna karşılık gelir; sadece “fiyat kategorisi seç, adet gir” şeklinde netleştirilebilir.

### B) Yer seçerek bilet (koltuk haritası / oturum planı)

- Müşteri **salon planından (seating plan)** kendi koltuğunu/yerini seçer.
- İnteraktif bir **koltuk haritası** üzerinden blok → sıra → koltuk seçimi yapılır.
- **Bizde yapılacak:** Venue’lere oturum planı eklenip, etkinlik sayfasında “Yer seç” ile bu plan açılacak ve seçilen koltuklar sepete eklenecek.

---

## 2. Bilet yeri seçme için gerekenler

### 2.1 Veri modeli

- **Venue (mekan)**  
  Zaten var. Ek: “Bu venue için oturum planı var mı?” (seat map / seating plan kullanılacak mı?)

- **Seating plan (oturum planı)** – venue’ye bağlı  
  - Bir venue’nün birden fazla “plan”ı olabilir (farklı etkinlik düzenleri).  
  - Plan: **sahne yönü, bloklar, sıralar, koltuklar** (ve isteğe bağlı **genel giriş alanları**).

- **Yapı önerisi:**

  ```
  venues (mevcut)
    └── seating_plans (yeni)
          ├── name, venue_id, is_default
          └── layout (JSON veya ayrı tablolar)

  seating_plan_sections (bloklar / bölümler)
    ├── seating_plan_id
    ├── name (örn. "Blok A", "Parket")
    ├── price_category_id veya event’e özel fiyat
    └── sort_order

  seating_plan_rows (sıralar)
    ├── section_id
    ├── row_label (örn. "1", "2", "A", "B")
    └── sort_order

  seats (koltuklar)
    ├── row_id (veya section_id + row_label)
    ├── seat_label (örn. "1", "2")
    ├── x, y (plan üzerinde koordinat – SVG/canvas için)
    └── status: available / reserved / sold (satış anında güncellenecek)
  ```

- **Etkinlik–plan ilişkisi:**  
  Etkinlik oluşturulurken “Bu etkinlik için hangi oturum planı kullanılsın?” seçimi (venue’ye ait planlardan).  
  Böylece aynı salonda farklı etkinliklerde farklı planlar kullanılabilir.

### 2.2 Fiyat kategorileri

- **Fiyat kategorisi** (örn. Kategori 1, VIP, Parket) → **section** veya **alan** ile eşleşmeli.
- Her section’a bir **bilet türü / fiyat** atanır (etkinlik bazında veya plan bazında).
- “Fiyat kategorisine göre” akışında müşteri bu kategorilerden birini seçer; “yer seçerek” akışında tıkladığı koltuk hangi section’daysa o fiyat uygulanır.

### 2.3 Gerçek zamanlı kullanılabilirlik

- Her **seat** için: `available | reserved | sold`.
- Bilet “yer seç” ile sepete eklenirken koltuk **reserved** yapılır (geçici, timeout ile veya ödeme sonrası **sold**).
- Aynı koltuk aynı anda iki kişiye satılmamalı: **veritabanı + kilit (lock) veya optimistic lock** gerekir.

### 2.4 Frontend (UI) gereksinimleri

- **Seating plan görünümü:**
  - SVG veya Canvas ile çizilmiş salon planı.
  - Bloklar/sections renklerle veya fiyat kategorisine göre ayrılabilir.
  - Koltuklar tıklanabilir; duruma göre renk: boş (yeşil), seçili (mavi), dolu (gri), devre dışı.
- **Etkileşim:**
  - Section/blok seç → o bloktaki sıra/koltuk listesi veya zoom.
  - Koltuk tıkla → seç/seçimi kaldır; seçilen koltuklar listesi ve toplam fiyat.
  - “Sepete ekle” → seçilen koltuklar sepete, stok/koltuk durumu güncellenir.
- **Mobil:** Plan büyük olabilir; zoom/pan veya “liste görünümü” (blok – sıra – koltuk dropdown’ları) eklenebilir.

### 2.5 Özet checklist – Bilet yeri seçme için

| Gereksinim | Açıklama |
|------------|----------|
| Venue–Plan ilişkisi | Venue’ye bağlı seating_plans tablosu (veya JSON) |
| Blok / Section | Salon bölümleri (Parket, Balkon Sol, vb.) |
| Sıra (Row) | Her blokta sıra etiketleri (1, 2, A, B, …) |
| Koltuk (Seat) | Sıra + koltuk no; isteğe bağlı (x,y) koordinat |
| Fiyat–Section eşlemesi | Her section’a bilet türü/fiyat atanması |
| Koltuk durumu | available / reserved / sold + güncelleme kuralları |
| Eşzamanlılık | Aynı koltuğun çift satışını engelleme (lock/timeout) |
| UI: Plan görünümü | SVG/Canvas ile tıklanabilir koltuk haritası |
| UI: Seçim ve sepet | Seçilen koltuklar listesi, sepete ekle, fiyat özeti |
| Genel giriş (opsiyonel) | Blok yerine “alan” (capacity); numaralı koltuk yok |

---

## 3. Sayfa akışı (EventSeat tarzı)

1. **Etkinlik sayfası açılır.**
2. **Üstte iki seçenek:**
   - **“Fiyat kategorisine göre bilet al”** → Mevcut akış: bilet türü (Kategori 1, 2, İndirimli, vb.) + adet → sepete ekle.
   - **“Yer seçerek bilet al”** → Oturum planı açılır; koltuk seçilir → sepete ekle.
3. Eğer etkinlik için **oturum planı yoksa** “Yer seçerek bilet al” gizlenir veya devre dışıdır; sadece “Fiyat kategorisine göre” gösterilir.

---

## 4. Uygulama sırası önerisi

1. **Faz 1 – Seçeneklerin ayrımı (hızlı)**  
   - Etkinlik sayfasında iki sekme/kart: “Fiyat kategorisine göre bilet al” ve “Yer seçerek bilet al”.  
   - Şimdilik “Yer seçerek” tıklanınca “Bu etkinlik için koltuk seçimi henüz açılmamıştır” mesajı veya sadece devre dışı.

2. **Faz 2 – Veri modeli**  
   - `seating_plans`, `sections`, `rows`, `seats` (veya tek bir `venue_layout` JSON) tasarımı.  
   - Venue detayında “Oturum planı yükle/düzenle” (admin/organizatör).

3. **Faz 3 – Plan editörü (organizatör)**  
   - Blok/sıra/koltuk tanımlama veya CSV import.  
   - Fiyat kategorisi atama.

4. **Faz 4 – Müşteri tarafı “yer seç”**  
   - Plan görüntüleme, koltuk seçimi, sepete ekleme, stok rezervasyonu.

Bu doküman, EventSeat tarzı “fiyat kategorisine göre” ve “yer seçerek” ayrımını ve bilet yeri seçme için gerekenleri tanımlar. İstersen bir sonraki adımda sadece Faz 1 (iki seçeneğin UI’da ayrılması) için somut bileşen/sayfa değişikliklerini yazabilirim.
