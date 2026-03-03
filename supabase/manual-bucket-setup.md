# Supabase Storage Bucket Manuel Kurulum

## Sorun
Supabase storage tablosu versiyona göre farklı yapıda olabilir. SQL sorguları çalışmıyor.

## Çözüm: Supabase Dashboard'da Manuel Bucket Oluşturma

### Adım 1: Supabase Dashboard'a Git
1. Supabase projenize gidin
2. Sol menüden "Storage" seçin

### Adım 2: Bucket Oluşturma
1. "New bucket" butonuna tıklayın
2. Bucket bilgilerini girin:
   - Name: `event-images`
   - Public bucket: ✅ işaretleyin
   - File size limit: `10737418240` (10GB)
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

3. "Create" butonuna tıklayın

### Adım 3: İkinci Bucket Oluşturma
1. Tekrar "New bucket" butonuna tıklayın
2. Bucket bilgilerini girin:
   - Name: `artists`
   - Public bucket: ✅ işaretleyin
   - File size limit: `10737418240` (10GB)
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

3. "Create" butonuna tıklayın

### Adım 4: Bucket'ları Kontrol Et
Storage sayfasında bucket'ların göründüğünü doğrulayın:
- `event-images` (public)
- `artists` (public)

### Adım 5: Test Et
1. Turne yönetim sayfasına gidin
2. Sanatçı ekleme formunda resim yüklemeyi deneyin
3. Console'da hata mesajlarını kontrol edin

## Beklenen Sonuç
- ✅ Bucket'lar oluşturuldu
- ✅ Resim yükleme çalışır
- ✅ "Bucket not found" hatası kalkar
- ✅ Turne yönetimi tam fonksiyonel

## Not
Eğer storage tablosu erişilemiyorsa, Supabase destek ile iletişime geçin.
