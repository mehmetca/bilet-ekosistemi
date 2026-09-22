# PLAN: Sayfa Yönetim Sistemi (mini-CMS) — Gelecek Plan

> Durum: PLAN — henüz uygulanmadı. Local'de tutulur, commit/dağıtım yok.

## Amaç
Siteden (yonetim panelinden) yeni sayfa ekleyebilmek, menüye ekleyebilmek, gerektiğinde kaldırabilmek — kod/derleme gerektirmeden.

## Mimari

### 1) Supabase tablosu: `pages`
- `id` (uuid)
- `slug` (unique) — ör. `hakkimizda`, `sss-2`
- `title_tr`, `title_de`, `title_en`, `title_ku`, `title_ckb`
- `content_tr`, `content_de`, `content_en`, `content_ku`, `content_ckb` (HTML — Quill/RichTextEditor)
- `show_in_menu` (bool) + `sort_order` (menü sırası)
- `is_published` (bool) — taslak/yayında
- `created_at`, `updated_at`
- RLS: admin yazabilir; herkese yalnızca `is_published = true` okuma

### 2) Yönetim paneli
- `/yonetim/sayfalar` → liste + ekle/düzenle/sil
- Form: slug, 5 dil başlık/içerik, "Menüde göster", sıra, "Taslak/Yayında"
- Mevcut `AdminOnlyGuard`, supabase client ve API desenleri kullanılır

### 3) Dinamik sayfa
- `app/[locale]/[...slug]/page.tsx`
- `pages` tablosundan slug + locale + `is_published=true` çek
- Header/Footer içinde içerik basılır; içerik sanitize edilir
- Bulunamazsa 404
- SEO metadata + sitemap eklenebilir

### 4) Menü
- Header menüsü statik kalmayacak
- `show_in_menu = true` olan sayfalar `sort_order` ile çekilip mevcut linklere eklenir
- Menüden kaldır = bayrağı kapat (adres yine açılır) veya sayfayı sil

## Local test → canlıya alma
- Değişiklikler `sayfa-sistemi` dalında; `npm run dev` ile bakılır
- ⚠️ Local dev AYNI Supabase projesini kullanır → deneme sayfaları **Taslak** tutulmalı
- Canlı kodda henüz rota/panel yokken oluşturulan sayfalar canlıda görünmez (zararsız)
- Beğenilmezse: `git switch main` (kod) + taslakları yönetim/SQL ile sil
- Beğenilirse: dal → main merge → push → Coolify deploy → yayına al

## Notlar / Güvenlik
- İçerik HTML olduğu için yazma yetkisi admin'e özel
- Render'da etiket temizliği (sanitize) şart
- Slug benzersiz olmalı, çakışmada uyarı
- Alternatifler: Payload CMS, Strapi, Sanity — ağır olduğu için önerilmez

---

# PLAN (Ek): Etkinlik URL / SEO İyileştirme

> Durum: PLAN — uygulanmadı. Google açısından UUID URL'ler sorunsuz indexlenir; amaç okunur URL + CTR artışıdır.

## Önerilen yaklaşım
- Tek etkinlik: `/en/events/{benzersiz-slug}` — slug = başlık + kısa ID (örn. `kayhan-kalhor-europe-tour-2026-8f3a`)
- Sanatçı/etkinlik grubu: `/sanatci/{sanatci-slug}` ayrı tutulur
- Slug dile göre değişmez (aynı etkinlik 5 dilde tek URL)

## Yapılmaması gereken
- Aynı `/etkinlik/` altında hem sanatçı adı hem etkinlik slug'ı karıştırılmamalı (çakışma riski)
- Şehir+tarih+saat tabanlı URL (örn. `diyar/etkinlik/manheim.24.10.2026.20.30`) kırılgan: erteleme/taşınmada URL değişir, çok dilli şehir adı duplicate içerik üretir

## Geçiş şartları
- Eski `/etkinlik/{uuid}` adreslerinden yeni URL'ye **301 kalıcı yönlendirme**
- Canonical + sitemap güncellemesi
- Aynı başlıklı etkinliklerde benzersiz slug garantisi (ID eklenir)
