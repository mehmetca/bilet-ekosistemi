# Salon Tasarım Vizörü – Nasıl Çalışır?

## Ne?

**Salon Tasarım Vizörü**, salonu **bölge (zone)** bazında tasarlayıp önizlemenizi sağlayan bir sayfadır. **Salonda toplam kaç koltuk olacağı** hedefini girebilir, bölgeleri **dikey (tek blok)** veya **koridorla bölünmüş (2 blok / 3 blok)** olarak tanımlayabilirsiniz. Veritabanına yazmaz; kaydetmek için **Oturum planı** sayfasını kullanırsınız.

---

## Salonda kaç koltuk olacak?

Sayfanın üstündeki **"Salonda toplam kaç koltuk olsun? (hedef)"** alanına isteğe bağlı bir sayı (örn. 500) girebilirsiniz. Vizör, mevcut bölgelerden hesaplanan toplam koltuk sayısını gösterir ve hedefe göre **eşit / üzerinde / altında** bilgisini verir. Tasarımı bu hedefe göre bölge ekleyerek veya koltuk/sıra sayılarını değiştirerek ayarlayabilirsiniz.

---

## Düzen: Dikey, koridor, bloklar – Nasıl anlatılır?

Her bölgede **Düzen** seçeneği vardır:

| Düzen | Açıklama | Koltuk girişi |
|-------|----------|----------------|
| **Tek blok (dikey)** | Koridorsuz, tek parça alan. Örn. Empore links, Empore rechts – sıralar arkaya doğru tek blok halinde. | **Koltuk/sıra** = o sıradaki toplam koltuk. |
| **2 blok (1 koridor)** | Sol ve sağ blok; arada **ara koridor**. Örn. Empore Mitte ilk 4 sıra – ortada koridor, ikiye ayrılmış. | **Her blokta koltuk/sıra** = sol ve sağda sıra başına koltuk (toplam sıra başına 2×). |
| **3 blok (2 koridor)** | Sol + orta + sağ; **2 koridor**. Örn. Empore Mitte 5. sıradan itibaren – iki koridorla üç blok. | **Her blokta koltuk/sıra** = her blokta sıra başına koltuk (toplam 3×). |

- **Dikey:** Blok adı (Empore links, Empore rechts) tek parça, sıralar dikey/arkaya uzanıyor; koridor yok.
- **Ara koridor:** Sıraların ortasında geçiş için bırakılan boşluk; koltuk sayısına dahil değildir. Vizörde "2 blok" veya "3 blok" seçerek sol/sağ veya sol/orta/sağ koltuk sayılarını ayrı ayrı (her blokta kaç koltuk) girersiniz.

---

## Örnek: Empore links, Empore rechts, Empore Mitte

- **Empore links** ve **Empore rechts** → **Tek blok (dikey)**. Sıra 1–6, sıra başına 12 koltuk. Koridorsuz.
- **Empore Mitte, ilk 4 sıra** → **2 blok (1 koridor)**. Sıra 1–4; ortada ara koridor, ikiye ayrılmış. Her blokta sıra başına 8 koltuk → sıra başına toplam 16 (8+8).
- **Empore Mitte, 5. sıradan itibaren** → **3 blok (2 koridor)**. Sıra 5–10; iki koridorla üç blok (sol + orta + sağ). Her blokta sıra başına 6 koltuk → sıra başına toplam 18 (6+6+6).

Vizörde bu yapıyı kurduğunuzda önizlemede "Tek blok", "2 blok (1 koridor)", "3 blok (2 koridor)" ve sıra başına koltuk dağılımı (örn. 8+8, 6+6+6) görünür. Gerçek oturum planında her blok için ayrı **bölüm** (section) açıp sıra ve koltukları girebilirsiniz (Empore Mitte 1–4 sol, Empore Mitte 1–4 sağ gibi).

---

## Yöntem: Bölge tabanlı fiyatlandırma

- **Bölge** = ad + sıra aralığı + **düzen** (tek / 2 blok / 3 blok) + koltuk sayısı + bilet kategorisi.
- Her bölge tek bir fiyat kategorisine karşılık gelir. Etkinlikte aynı isimde bilet türü ekleyip fiyat verirsiniz.

---

## Sayfada neler var?

1. **Salon toplam koltuk hedefi**  
   İsteğe bağlı sayı; tasarımı bu hedefe göre yapmanızı sağlar.

2. **Yardım kutusu**  
   "Nasıl çalışır?" ile açılıp kapanır; düzen ve koridor mantığını anlatır.

3. **Yeni bölge ekle**  
   - Bölge adı  
   - Sıra başlangıç / bitiş  
   - **Düzen:** Tek blok (dikey) / 2 blok (1 koridor) / 3 blok (2 koridor)  
   - Koltuk/sıra (tek blokta toplam; 2 veya 3 blokta **her blokta** koltuk/sıra)  
   - Bilet kategorisi  
   "Bölge ekle" ile listeye eklenir.

4. **Salon önizleme**  
   Bölgeler bloklar halinde; her satırda düzen (tek blok / 2 blok / 3 blok) ve sıra başına koltuk dağılımı (örn. 8+8, 6+6+6) gösterilir.

5. **Özet**  
   Toplam koltuk ve kategori bazında sayılar. Gerçek plan için **Mekanlar → [Mekan] → Oturum planı** hatırlatması.

---

## Akış (vizör → gerçek plan)

1. **Vizörde** istediğiniz bölgeleri ekleyin; özeti kontrol edin.
2. **Mekanlar** → ilgili mekan → **Oturum planı** sayfasına gidin.
3. Orada her bölge için **bir bölüm (section)** oluşturun:
   - Bölüm adı = vizördeki bölge adı (veya sizin tercih ettiğiniz isim).
   - **Bilet türü etiketi** = vizörde seçtiğiniz kategori adı (VIP, Kategori 1, …) — **bire bir aynı** olmalı.
   - İlgili sıra ve koltukları (sıra 1–2, 3–4, … ve her sıradaki koltuk sayısı) oturum planı arayüzünde tanımlayın.
4. **Etkinlik oluştururken** bu mekan ve oturum planını seçin; bilet türlerini **aynı etiket adlarıyla** (VIP, Kategori 1, …) ekleyip fiyat verin.

Böylece vizörde gördüğünüz yapı, veritabanındaki oturum planı ve etkinlik biletleriyle uyumlu hale gelir.

---

## Teknik not

- Vizör **sadece önizleme** içindir: state React tarafında tutulur, sayfa yenilenince sıfırlanır.
- Veritabanına **ek tablo veya alan eklenmez**; mevcut `seating_plans` → `seating_plan_sections` → `seating_plan_rows` → `seats` yapısı ve `ticket_type_label` kullanımı aynen geçerlidir.

Sayfa yolu: **Yönetim → Salon tasarım vizörü** (organizatör ve admin menüsünde).
