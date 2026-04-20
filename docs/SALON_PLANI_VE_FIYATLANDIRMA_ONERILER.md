# Salon Planı, Kategori ve Fiyatlandırma – Sektör Araştırması ve Öneriler

Bu belge, tipik bilet platformlarında salon/koltuk/fiyat yapısını özetler; mevcut sistemimizle karşılaştırır ve **sistemi değiştirmeden** organizatörün “orta salon ilk 2 sıra VIP, sonra 2 sıra Kategori 1…” gibi planlarını nasıl gerçekleştirebileceğini açıklar.

---

## 1. Sektörde Kim Salonu Tasarlıyor?

| Yaklaşım | Salon/oturum planını kim tasarlar? |
|----------|-------------------------------------|
| **Platform A (organizatör odaklı harita)** | Organizatör. Ayrılmış oturum seçilince mekân tasarım aracı açılır; organizatör bölümler (sections), sıralar, masalar ekler. Şablon veya boş tuvalden başlayabilir. |
| **Platform B (kategori / mekân odaklı)** | Kategoriler (1. Kategori, 2. Kategori…) sahnenin farklı alanlarına karşılık gelir; salon planı ve kategoriler genelde platform veya mekân ile birlikte tanımlanır, organizatör etkinlikte fiyat verir. |
| **Platform C (mekân planı sabit)** | Mekân/salon planı genelde platform veya mekân tarafından sağlanır; blok/sıra/koltuk yapısı sabit, organizatör fiyat kategorilerini bu yapıya göre atar. |

**Bizim sistem:** Salon planı **mekana (venue)** bağlı. Planı **admin/controller** veya (yetki verilirse) organizatör **Yönetim → Mekanlar → [Mekan] → Oturum planı** ekranında oluşturur. Yani salonu tasarlayan siz (platform) veya organizatör; mekan listeden seçilir, o mekandaki plan(lar) kullanılır.

---

## 2. Aynı Salonda Farklı Oturum Düzeni (Etkinliğe Göre)

- **Platform A:** Aynı mekan için daha önce oluşturulmuş haritayı açıp **etkinlik bazında düzenleyebilir**; kapasite ve bölümleri etkinliğe göre değiştirebilir.
- **Bizim sistem:** Bir venue’nün **birden fazla oturum planı** olabilir (`seating_plans` tablosu, `venue_id` ile). Etkinlik oluştururken **“Oturum planı (koltuk seçimi)”** alanından o mekandaki planlardan biri seçilir.  
  **Sonuç:** Aynı salonda “Konser için 40 sıra”, “Tiyatro için 20 sıra” gibi farklı düzenler istiyorsanız, o mekan için **iki ayrı plan** tanımlanır (örn. “Salon – Konser”, “Salon – Tiyatro”); etkinlikte hangi etkinlikte hangi düzen varsa o plan seçilir. Mevcut veri modeli buna izin veriyor.

---

## 3. Fiyat Kategorileri (VIP, Kategori 1, Normal, Ucuz, Balkon…)

- **Platform A:** Bölümler (sections) tanımlanır; farklı bölümlere farklı fiyat verilir; “en iyi uygun yer” veya koltuk seçimi ile satış yapılır.
- **Platform B:** 1. Kategori, 2. Kategori… şeklinde kategoriler; koltuk seçiminde kategoriye göre fiyat uygulanır.
- **Bizim sistem:**  
  - **Bölüm (section)** = `seating_plan_sections`. Her bölümün **`ticket_type_label`** alanı var (örn. `"VIP"`, `"Kategori 1"`, `"Kategori 2"`).  
  - Etkinlikte tanımlanan **bilet türlerinin adı** (tickets.name) bu etiketle **bire bir eşleşmeli**. Kullanıcı bir koltuk seçtiğinde, o koltuk hangi bölümdeyse o bölümün `ticket_type_label`’ına karşılık gelen biletin fiyatı uygulanır.  
  **Önemli:** Fiyat **bölüm bazında** (section), koltuk bazında değil. Aynı bölümdeki tüm koltuklar aynı fiyata satılır. “İlk 2 sıra VIP, sonraki 2 sıra Kategori 1…” için **aynı fiziksel alanı (orta salon) sıra aralıklarına göre birden fazla bölüme bölmeniz** gerekir.

---

## 4. Sizin Senaryonuz: “Orta Salon 2 Sıra VIP, 2 Sıra Kategori 1, 10 Sıra Kategori 2…” – Mevcut Sistemle Nasıl Yapılır?

İstediğiniz mantık:

- Orta salon: ilk 2 sıra **VIP**, sonra 2 sıra **Kategori 1** (VIP’ten ucuz, diğerlerinden pahalı), sonra 10 sıra **Kategori 2** (standart), sonra 20 sıra **daha ucuz**, son 3–5 sıra **çok ucuz**.
- Balkon: ön sıralar **normal fiyat**, diğerleri **daha ucuz**.

Bunu **mevcut yapıda** yapmak için:

- **Bir “Orta salon” tek bölüm olarak kalmamalı.** Sıra aralıklarına göre **birden fazla bölüm** tanımlanmalı; her bölümün `ticket_type_label`’ı o fiyat kategorisinin adı olmalı.

Örnek bölümleme:

| Bölüm adı (name) | Sıra aralığı | ticket_type_label | Amaç |
|------------------|--------------|-------------------|------|
| Orta salon – VIP | Sıra 1–2 | VIP | En pahalı |
| Orta salon – Kategori 1 | Sıra 3–4 | Kategori 1 | VIP’ten ucuz, diğerlerinden pahalı |
| Orta salon – Kategori 2 | Sıra 5–14 | Kategori 2 | Standart fiyat |
| Orta salon – Ekonomi | Sıra 15–34 | Ekonomi | Daha ucuz |
| Orta salon – Son sıralar | Sıra 35–39 | Çok ucuz | En ucuz |
| Balkon ön | Balkon sıra 1–3 | Kategori 2 (veya Balkon Ön) | Normal fiyat |
| Balkon arka | Balkon sıra 4+ | Balkon Ekonomi | Daha ucuz |

Adımlar:

1. **Yönetim → Mekanlar → [Salonunuz] → Oturum planı** sayfasında:
   - Bu mekan için bir plan oluşturun (veya mevcut planı kullanın).
   - **Bölüm ekle** ile yukarıdaki gibi her “sıra aralığı + fiyat kategorisi” için bir bölüm ekleyin (örn. “Orta salon – VIP”, “Orta salon – Kategori 1” …).
   - Her bölümün **Bilet türü etiketi** alanına (`ticket_type_label`) tam olarak kullanacağınız bilet adını yazın: `VIP`, `Kategori 1`, `Kategori 2`, `Ekonomi`, `Çok ucuz`, `Balkon Ön`, `Balkon Ekonomi` vb.
   - Her bölüm için **sıra** ve **koltuk** ekleyin (sıra 1–2 için 2 sıra, her sırada kaç koltuk varsa o kadar koltuk; aynı şekilde 3–4, 5–14 …).

2. **Yeni etkinlik sihirbazında:**
   - Tarih & mekan adımında bu **salonu listeden seçin** ve **oturum planını** (az önce düzenlediğiniz planı) seçin.
   - Biletler adımında, **oturum planındaki her `ticket_type_label` için bir bilet türü** ekleyin; **isim bire bir aynı olsun** (VIP, Kategori 1, Kategori 2, Ekonomi, Çok ucuz, Balkon Ön, Balkon Ekonomi). Fiyat ve kapasiteyi girin; “Kapasiteyi doldur” ile o bölümdeki koltuk sayısı otomatik doldurulabilir.

Böylece “salonu listeden seçiyorum, orada ne bölüm varsa ona göre fiyat veriyorum” akışı, mevcut sistemle bire bir uyumlu hale gelir: **Salondaki bölümler = fiyat kategorileri.** Bölümleri sıra aralıklarına göre siz tanımlarsınız.

---

## 5. İtfaiye / Polis / Güvenlik için Koltuk Ayırma

- **Genel uygulama:** Büyük etkinliklerde itfaiye, polis, güvenlik personeli için **yer** ayrılır; bu genelde **sahada konum** (acil çıkış yanı, kontrol noktaları) veya **belirli koltuk blokları** olarak yapılır. Birçok biletleme sisteminde bu koltuklar **satışa kapatılır** (blocked / hold / box office only).
- **Bazı oturum planı / bilet araçlarında:** Belirli koltuklar “blocked”, “hold”, “box office only” olarak işaretlenebilir; halka açık satışta görünmez veya satılamaz.
- **Bizim sistem:** Şu an `seats` ve `order_seats` yapısı var; **“bloke / rezerve (satışa kapalı)”** durumu için ayrı bir alan yok. İleride eklenebilir (örn. `seats.is_blocked` veya `event_seat_blocks` tablosu).  
  **Öneri (sistemi değiştirmeden):** İtfaiye/polis/güvenlik için ayırdığınız koltukları **hiç bilet türüne bağlamayın** veya **o koltukları oturum planına eklemeyin**. Sadece satışa açmak istediğiniz koltukları plana koyun; “ayrılan” koltuklar planda olmadığı için satılamaz. Alternatif: O koltukları ayrı bir bölümde tutup, o bölüm için **kapasitesi 0** veya **fiyatı çok yüksek + stok 0** bir bilet türü tanımlayabilirsiniz (daha çok workaround).

Kalıcı çözüm için ileride **koltuk/alan bloklama** (blocked / reserved for personnel) özelliği eklenmesi mantıklı.

---

## 6. Özet Öneriler (Mevcut Sistemi Değiştirmeden)

1. **Salon tasarımı:** Salonu siz veya organizatör, **Mekanlar → [Mekan] → Oturum planı** ile tasarlıyorsunuz. Organizatörün “plan elimde” demesi = bu ekranda bölüm/sıra/koltuk girmesi veya şablon (örn. Musensaal) ile başlayıp düzenlemesi.
2. **“Orta salon ilk 2 sıra VIP, sonra 2 sıra Kategori 1…”:** Aynı fiziksel alanı **sıra aralığına göre birden fazla bölüme** bölün; her bölümün **`ticket_type_label`** = o kategorinin adı (VIP, Kategori 1, …). Etkinlikte bilet türü adlarını bu etiketlerle **bire bir aynı** yapın; fiyatı bilet türünde verin. Mevcut yapı bunu destekliyor.
3. **Aynı salonda farklı düzen:** Mekan için **birden fazla oturum planı** tanımlayın; etkinlik oluştururken ilgili planı seçin. Değişiklik yok.
4. **Salonu listeden seçip bölüme göre fiyat:** Mekan seçildikten sonra oturum planı ve plan içindeki bölümler (ve `ticket_type_label`) belirliyor; organizatör bilet adını bu etiketlerle eşleştirip fiyat veriyor. Bunu **kullanım kılavuzu** veya **etkinlik sihirbazında kısa bir bilgi kutusu** ile netleştirmek faydalı olur (örn. “Oturum planındaki bölüm etiketleriyle aynı isimde bilet türü ekleyin”).
5. **İtfaiye/polis/güvenlik koltukları:** Şu an en pratik yol, bu koltukları planda **satışa açmamak** (plana eklememek veya ayrı bölüm + 0 kapasite workaround). İleride **bloke/rezerve** alanı eklenebilir.

Bu adımlarla mevcut sisteminiz, tipik “salon → bölüm/kategori → fiyat” akışına cevap verir; ek geliştirme olmadan organizatörünüz “orta salon ilk 2 sıra VIP…” planını bölümleri parçalayarak uygulayabilir.
