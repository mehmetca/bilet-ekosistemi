# Bilgilendirme sayfaları – kapsam karşılaştırması (referans)

Bu belge, tipik kurumsal/bilgilendirme sayfaları (referans olarak çok satıcılı bilet sitelerinde görülen yapı) ile Bilet Ekosistemi’ndeki karşılıkları eşleştirir; eksik veya güçlendirilmesi gereken alanları listeler.

---

## Referans yapı → Bizde karşılığı

| Referans (örnek) | Bilet Ekosistemi | Durum |
|-----------|------------------|--------|
| **Impressum** | `/bilgilendirme/impressum` (İletişim Bilgileri) | ✅ Var |
| **Privacy Notice / Privacy Policy** | `/bilgilendirme/veri-bilgisi` + `/bilgilendirme/cerez-politikasi` | ✅ Var |
| **Terms of Use** | `/bilgilendirme/kullanim-kosullari` | ✅ Var |
| **Contract and Policies** | Mesafeli satış + Kullanım koşulları | ✅ Var |
| **Cookie Policy** | `/bilgilendirme/cerez-politikasi` | ✅ Var |
| **FAQ / Help** | `/bilgilendirme/sss` (Sık Sorulan Sorular) | ✅ Var |
| **Contact** | Impressum, Veri bilgisi, Mesafeli satış, Çerez sayfalarında “İletişim” bölümü | ✅ Var |
| **Cancellation, Return and Exchange** | SSS’te “İade veya değişiklik” (refundChange) + Footer “İade Politikası” kısa metni | ✅ Var (içerik dağınık) |
| **How to Buy Tickets** | SSS’te bilet teslimi, sepet, ödeme, çoklu etkinlik vb. | ✅ Var |
| **Lost Your Ticket?** | SSS’te “Biletimi kaybettim” (lostTicket) | ✅ Var |
| **Online Payment Terms** | Mesafeli satış ve Veri bilgisi sayfalarında ödeme bahsi; footer “Güvenli Ödeme” | ⚠️ Ayrı sayfa yok |
| **Customer service / Call Center** | İletişim Impressum’da; ayrı “Müşteri Hizmetleri” sayfası yok | ⚠️ Ayrı sayfa yok |
| **About Us** | Footer’da “Bilgilendirme” menüsü; “Hakkımızda” için ayrı kurumsal sayfa yok | ⚠️ Ayrı sayfa yok |
| **Purchase Processes** | SSS’te adım adım anlatım var; tek bir “Satın alma süreçleri” rehberi yok | ⚠️ İsteğe bağlı rehber sayfası eklenebilir |
| **Integrated Management System Policy** | Yok (ISO / kalite yönetimi – genelde büyük kurumsal sitelerde) | ❌ Küçük bilet platformu için zorunlu değil |

---

## Eksik veya değiştirilmesi gerekenler – Öneriler

### 1. **Online Ödeme Koşulları (Online Payment Terms)**  
- **Eksik:** Bazı sitelerde ayrı bir sayfa; sizde bilgi mesafeli satış ve veri sayfalarına dağılmış.  
- **Öneri:** İsterseniz `/bilgilendirme/online-odeme-kosullari` gibi tek bir sayfa açıp ödeme yöntemleri, güvenlik, 3D Secure, iade ödemeleri vb. tek yerde toplanabilir. Yoksa mevcut metinlerde “Ödeme” bölümünü biraz genişletmek de yeterli olabilir.

### 2. **Müşteri Hizmetleri / İletişim (Customer service)**  
- **Eksik:** Bazı sitelerde tek bir müşteri hizmetleri sayfası var; sizde iletişim sadece Impressum ve diğer sayfalarda.  
- **Öneri:** `/bilgilendirme/iletisim` veya `/bilgilendirme/musteri-hizmetleri` sayfası eklenebilir: çalışma saatleri, e-posta, form, “Bilet nasıl alınır / iade / kayıp bilet” kısa linkleri. İsterseniz Impressum’u “İletişim & Müşteri Hizmetleri” başlığıyla genişletmek de mümkün.

### 3. **Hakkımızda (About Us)**  
- **Eksik:** Kurumsal “Bizi tanıyın” sayfası yok.  
- **Öneri:** `/bilgilendirme/hakkimizda` eklenebilir: platformun amacı, kısa tanıtım, neden güvenilir, linkler (İletişim, SSS, Mesafeli satış).

### 4. **İptal / İade / Değişim – Tek sayfa**  
- **Mevcut:** SSS’te ve footer’da var; dağınık.  
- **Öneri:** Zorunlu değil; ancak “İade ve İptal Politikası” tek sayfada toplanırsa (link: footer’daki “İade Politikası”) hem referans yapıdaki “Cancellation, Return and Exchange” ile tam eşleşir hem de kullanıcı tek yerden okur.

### 5. **Yazım / ifade kontrolü**  
- **Öneri:** Tüm bilgilendirme sayfalarında (özellikle Impressum, Mesafeli satış, Kullanım koşulları, Çerez, Veri bilgisi):  
  - Şirket adı, adres, e-posta gerçek bilgilerle güncel mi kontrol edin.  
  - “Bilet Ekosistemi, Almanya merkezli bir şirkettir” gibi ifadeler şirket yapınıza uyuyorsa bırakın; değilse (örn. Türkiye merkezli) düzeltin.

---

## Özet tablo

| Konu | Sizde var mı? | Öneri |
|------|----------------|--------|
| Impressum | ✅ | — |
| Gizlilik / Veri / Çerez | ✅ | — |
| Kullanım koşulları | ✅ | — |
| Mesafeli satış sözleşmesi | ✅ | — |
| SSS (FAQ, bilet kaybı, iade, nasıl alınır) | ✅ | — |
| İletişim (sayfa içi bölümler) | ✅ | — |
| Online ödeme koşulları (ayrı sayfa) | ❌ | Ayrı sayfa veya mevcut sayfalarda “Ödeme” bölümünü genişletin. |
| Müşteri hizmetleri (tek sayfa) | ❌ | İsteğe bağlı: `/bilgilendirme/iletisim` veya Impressum’u genişletin. |
| Hakkımızda | ❌ | İsteğe bağlı: `/bilgilendirme/hakkimizda`. |
| İade/iptal (tek sayfa) | Kısmen (footer + SSS) | İsteğe bağlı: tek “İade ve İptal” sayfası. |
| Integrated Management System | ❌ | Küçük platform için gerek yok. |

**Sonuç:** Yasal ve bilgilendirme açısından temel sayfalar (Impressum, gizlilik, çerez, kullanım koşulları, mesafeli satış, SSS, iletişim, iade/bilet kaybı) sitede mevcut. Referans seviyesine yaklaşmak için en mantıklı ekler: **Online ödeme koşullarının** netleştirilmesi (ayrı sayfa veya mevcut sayfalarda), isteğe bağlı **Müşteri hizmetleri** ve **Hakkımızda** sayfalarıdır.
