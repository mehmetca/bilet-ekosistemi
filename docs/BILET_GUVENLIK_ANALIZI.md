# Bilet güvenlik analizi – Kopya / sahte bilet riski

## Kısa cevap

- **Kopya (aynı biletin iki kopyası):** Sistem doğru çalışıyor. Bilet kodu sunucuda **tek kullanımlık** (checked_at). İlk okutma giriş yapıldı olarak işaretleniyor, ikinci okutma "Bu bilet daha önce kullanılmıştır" diyor. Yani biletin ekran görüntüsü veya fotokopisi ile ikinci kişi giremez.
- **Sahte (uydurma kod):** Kod tahmin edilemez olmalı. Şu an kod üretimi **kripto güvenli** hale getirildi (crypto); format ve uzunluk aynı kaldı. Doğrulama tamamen **sunucu taraflı** (veritabanı); QR/barkod sadece kodu taşıyor, güvenlik sunucudaki kayıda dayanıyor.
- **QR/barkod üretimi:** Sadece görsel; güvenlik API’deki kod sorgusunda. Sahte bilet “geçerli” sayılmaz çünkü kod veritabanında yok veya kullanılmış.

---

## Mevcut mimari (özet)

| Bileşen | Ne yapıyor |
|--------|------------|
| **Bilet kodu** | `BLT-` + 8 karakter (A–Z, 2–9; 0/O/1/I yok). Her sipariş/koltuk için **benzersiz** kod. |
| **QR kod** | JSON: `{ code, event, date, time, venue, buyer, quantity }`. Doğrulamada **sadece `code`** kullanılıyor; içerik imzalı değil. |
| **Barkod** | Code128 ile sadece bilet kodu. Okutulunca aynı kod sunucuya gidiyor. |
| **Doğrulama** | `/api/check-ticket` ve check-in: kod **veritabanında** aranıyor (`orders.ticket_code` veya `order_seats.ticket_code`). Durum: sipariş tamamlandı mı, `checked_at` dolu mu, etkinlik tarihi geçmiş mi. |
| **Check-in** | `order_seats.checked_at` veya `orders.checked_at` güncelleniyor. Aynı kod ikinci kez okutulunca "kullanılmış" dönüyor. |

---

## Riskler ve durum

### 1. Biletin kopyası (foto / ekran / çıktı)

- **Senaryo:** Biri biletin ekran görüntüsünü veya PDF’ini alıp ikinci bir kişi de aynı kodu okutturuyor.
- **Durum:** İlk okutma check-in yapıyor; ikinci okutma "Bu bilet daha önce kullanılmıştır" veriyor. Yani **tek biletle tek giriş**; kopya ile giriş engelleniyor.
- **Not:** Aynı anda iki farklı giriş noktasında okutulursa teorik yarış (race) ihtimali var; aşağıda “Check-in atomikliği” ile azaltılabilir.

### 2. Sahte bilet (uydurma kod)

- **Senaryo:** Saldırgan rastgele veya tahminle bir kod (örn. BLT-XXXXXXXX) üretip sahte bilet basıyor.
- **Koruma:**
  - Kod **sadece sunucuda** geçerli sayılıyor; veritabanında yoksa "Bilet bulunamadı".
  - Kod üretimi **kriptografik rastgele** (Node `crypto.randomBytes` + güvenli karakter seti); tahmin edilebilir değil.
  - Olası kod sayısı (32^8) çok büyük; kaba kuvvet pratik değil.
- **Sonuç:** Sahte kodla giriş pratikte mümkün değil.

### 3. QR içeriğinin değiştirilmesi

- QR’da sadece metin/JSON var; **imza yok**. Biri QR içeriğini değiştirebilir ama:
  - Kapıda **okutulan ve sunucuya giden şey bilet kodu** (veya QR’dan parse edilen `code`).
  - Sunucu sadece bu kodu veritabanında arıyor; etkinlik adı vs. doğrulamada kullanılmıyor.
- Yani değiştirilmiş QR ile **yeni bir geçerli kod üretemez**; mevcut geçerli bir kodu bilmiyorsa giriş yine olmaz.

### 4. Barkod API’nin kötüye kullanımı

- `GET /api/barcode?code=XXX` herhangi bir kod için barkod resmi üretiyor; kodun geçerli olup olmadığını kontrol etmiyor.
- Bu **bilinçli**: Barkod sadece görsel; güvenlik **check-ticket / check-in** API’sinde. Sahte barkod basmak, geçersiz bir kodu “güzel göstermek”ten ibaret; kapıda yine "Bilet bulunamadı" alır.
- Ek önlem: İsterseniz bu API’ye rate limit veya sadece giriş yapmış kullanıcıya kısıtlama eklenebilir; güvenlik zorunluluğu değil.

### 5. Check-in yarışı (aynı bilet aynı anda iki kez)

- Şu an: Önce satır okunuyor (`checked_at` boş mu), sonra güncelleme. Aynı anda iki istek gelirse ikisi de “boş” görüp ikisi de güncelleyebilir; pratikte nadir ama mümkün.
- **Öneri:** Check-in’i **atomik** yapın:  
  `UPDATE order_seats SET checked_at = now() WHERE id = ? AND checked_at IS NULL RETURNING id`  
  Dönüş boşsa "Bilet zaten kullanılmış" deyin. Aynı mantık `orders` için de uygulanabilir.

---

## Yapılan iyileştirme: Bilet kodu üretimi

- **Eski:** `Math.random()` ile 8 karakter. Rastgelelik tarayıcı/sunucu ortamına göre değişir; kriptografik amaçlı değil.
- **Yeni:** Node.js `crypto.randomBytes` kullanılıyor; karakter seti aynı (okunaklılık için 0/O/1/I yok). Aynı format (`BLT-` + 8 karakter), daha güçlü rastgelelik.

Bu sayede bilet kodları tahmin edilemez; sahte bilet riski (kodu uydurma) pratikte kalmıyor.

---

## Özet tablo

| Soru | Cevap |
|------|--------|
| Biletin kopyası ile ikinci kişi girebilir mi? | Hayır. İlk okutma girişi işaretliyor, ikinci "kullanılmış" döner. |
| Birisi rastgele kod uydurup sahte bilet basabilir mi? | Pratikte hayır. Kod kripto rastgele; doğrulama sunucuda; tahmin/kaba kuvvet anlamsız. |
| QR/barkod sistemi sağlam mı? | Doğrulama tamamen sunucuda; QR/barkod sadece kodu taşır. Sistem bu anlamda sağlam. |
| İyileştirilebilir mi? | Evet: check-in’i atomik yapmak (yukarıdaki UPDATE), isteğe bağlı rate limit, ileride QR için imza (offline doğrulama gerekirse). |

---

## Sonuç

- **Kopya:** Tek bilet = tek giriş; kopya ile giriş engelleniyor.
- **Sahte:** Kod üretimi kripto güvenli; doğrulama sunucuda; sahte kodla giriş pratikte yok.
- **QR/barkod:** Güvenlik koda ve sunucu doğrulamasına dayanıyor; mevcut tasarım bu amaca uygun.

İsterseniz bir sonraki adımda check-in’i atomik UPDATE ile güncelleyebiliriz (race koşulunu tamamen kapatmak için).
