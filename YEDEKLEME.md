https://github.com/mehmetca/bilet-ekosistemi


https://github.com/mehmetca/bilet-ekosistemi.git




# Bilet Ekosistemi – Yedekleme ve “Unutma” Önlemleri

Bu projeyi kaybetmemek ve ileride WordPress ile karıştırmamak için yapılacaklar.

---

## 1. Klasör yedeği

- Bu klasörü (`bilet-ekosistemi`) **farklı bir yere kopyalayın** (örn. `bilet-ekosistemi-backup-2026` veya OneDrive/Dropbox).
- **node_modules** kopyalamasanız da olur (her yerde `npm install` ile yeniden kurulur). Önemli olan: `src`, `public`, `.env.local`, `package.json`, `tailwind.config.*`, `next.config.*` gibi dosyaların yedeği olsun.
- Periyodik yedek: Büyük güncelleme öncesi veya ayda bir tekrar kopyalayın.

---

## 2. Git kullanıyorsanız – tag (sürüm işareti)

Projeyi Git ile takip ediyorsanız, “bu anki hali unutulmasın” diye bir etiket atın:

```bash
git add -A
git commit -m "Bilet Ekosistemi kararlı sürüm (WordPress öncesi)"
git tag -a v1-nextjs -m "Next.js canlı sürüm - WordPress'e geçmeden önce"
```

İleride bu sürüme dönmek için: `git checkout v1-nextjs`

Git henüz kullanmıyorsanız:

```bash
cd c:\bilet-ekosistemi
git init
git add .
git commit -m "İlk commit - Bilet Ekosistemi Next.js"
git tag -a v1-nextjs -m "Next.js canlı sürüm"
```

---

## 3. Hangi site nerede? (Not tutun)

İki siteyi aynı anda kullanırken karışmaması için aşağıyı kendi bilgilerinizle doldurup saklayın:

| Ne | Nerede / Hangi adres |
|----|----------------------|
| **Canlı site (Next.js)** | Bu proje. Domain: _______________ (örn. bilet-ekosistemi.vercel.app) |
| **WordPress sürümü** | Ayrı proje. Domain veya local: _______________ |
| **Şu an “ana” site hangisi?** | _______________ (Next.js / WordPress) |

Bu tabloyu bu dosyada tutabilir veya kendi notlarınıza kopyalayabilirsiniz. Domain’leri ve “ana site”yi güncelledikçe bu tabloyu da güncelleyin.

---

## Özet

1. **Klasör yedeği** – Projeyi başka bir yere kopyalayın (özellikle `src`, `public`, env, config).
2. **Git tag** – Git kullanıyorsanız `v1-nextjs` gibi bir tag atın; bu sürüm kayıtlı kalsın.
3. **Hangi site nerede** – Next.js ve WordPress’in domain/local bilgisini ve hangisinin “ana” olduğunu yazıp güncel tutun.

Bu üç adım, “bu siteyi unutma” ve “hangi site nerede” sıkıntısını önlemek için yeterlidir.
