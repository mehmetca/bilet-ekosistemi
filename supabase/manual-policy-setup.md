# Supabase Storage Manual Policy Kurulum

## Sorun
Storage policies tablosu bulunamıyor. SQL sorguları çalışmıyor.

## Çözüm: Supabase Dashboard'da Manual Policy Oluşturma

### Adım 1: Supabase Dashboard'a Git
1. Supabase projenize gidin
2. Sol menüden "Storage" seçin

### Adım 2: Bucket Seçimi
1. "event-images" bucket'ına tıklayın
2. Bucket içeriği görüntülenir

### Adım 3: Policy Oluşturma
1. Sağ üstte "Policies" butonuna tıklayın
2. "Create a new policy" butonuna tıklayın

### Adım 4: Public Read Policy Oluşturma
1. **Policy Name:** `Public Read Access`
2. **Allowed Operation:** `SELECT`
3. **Target Roles:** `anon, authenticated`
4. **Policy Definition:** `bucket_id = (SELECT id FROM buckets WHERE name = 'event-images')`
5. **"Save" butonuna tıklayın**

### Adım 5: Artists Bucket'ı İçin Policy
1. Geri dönüp "artists" bucket'ını seçin
2. "Policies" butonuna tıklayın
3. "Create a new policy" butonuna tıklayın

### Adım 6: Artists Policy Oluşturma
1. **Policy Name:** `Public Read Access`
2. **Allowed Operation:** `SELECT`
3. **Target Roles:** `anon, authenticated`
4. **Policy Definition:** `bucket_id = (SELECT id FROM buckets WHERE name = 'artists')`
5. **"Save" butonuna tıklayın`

### Adım 7: Bucket Public Access Kontrolü
1. Storage → Settings menüsüne gidin
2. "event-images" bucket'ı seçin
3. "Public bucket" seçeneğinin işaretli olduğundan emin olun
4. Aynı işlemi "artists" için yapın

### Adım 8: Test Et
1. Turne yönetim sayfasına gidin
2. Sanatçı ekleme formunda resim yüklemeyi deneyin
3. Console'da hata mesajlarını kontrol edin

## Alternatif Çözüm: RLS Devre Dışı Bırakma

Eğer policy oluşturma da olmazsa:

### Adım 1: Storage Settings
1. Storage → Settings menüsüne gidin
2. "event-images" bucket'ı seçin
3. "Row Level Security" (RLS) seçeneğini devre dışı bırak
4. Aynı işlemi "artists" için yapın

### Adım 2: Bucket Public Access
1. "Public bucket" seçeneğini işaretle
2. Değişiklikleri kaydet

## Beklenen Sonuç
- ✅ Public access policy'ler oluşturuldu
- ✅ Resim yükleme çalışır
- ✅ "Bucket not found" hatası kalkar
- ✅ Turne yönetimi tam fonksiyonel

## Not
Eğer manuel policy oluşturma da olmazsa:
1. Supabase destek ile iletişime geçin
2. Farklı bir Supabase projesi deneyin
3. Storage API yerine farklı bir yaklaşım deneyin
