# Supabase: Şifre sıfırlama e-posta şablonu

E-postanın gövdesine "Bilet Ekosistemi" tanıtımı ve "talep sizden değilse cevap vermeyin" uyarısını eklemek için:

1. **Supabase Dashboard** → **Authentication** → **Email Templates**
2. **"Reset password"** (Şifre sıfırlama) şablonunu seçin.
3. **Message (HTML)** alanında, mevcut içeriğin sonuna aşağıdaki bloğu ekleyebilir veya metni buna göre düzenleyebilirsiniz.

## Örnek ek metin (HTML)

Şablonun içinde `{{ .ConfirmationURL }}` vb. değişkenler zaten vardır. Aşağıdaki paragrafı, link butonunun altına ekleyin:

```html
<p style="margin-top: 24px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #475569;">
  <strong>Bilet Ekosistemi</strong> – Bu e-posta, şifre sıfırlama talebiniz üzerine gönderilmiştir.
  Bu talebi siz yapmadıysanız e-postaya cevap vermeniz gerekmez; bağlantıyı kullanmadığınız sürece şifreniz değişmeyecektir.
</p>
```

## Konu (Subject)

İsteğe bağlı, Türkçe örnek:

```
Bilet Ekosistemi – Şifre sıfırlama
```

Bu dosya yalnızca referans içindir. Asıl düzenleme Supabase Dashboard üzerinden yapılır.
