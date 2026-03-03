# Supabase Storage Policy Tam Doğru Syntax

## Hatalı Syntax
```sql
using ((bucket_id = 'event-images))
```

## Doğru Syntax
```sql
using (bucket_id = 'event-images')
```

## Supabase Dashboard'da Policy Oluşturma

### Adım 1: event-images Bucket'ı İçin
1. **Storage → event-images → Policies**
2. **Create a new policy**
3. **Policy Name:** `Public Read Access`
4. **Allowed Operation:** `SELECT`
5. **Target Roles:** `anon, authenticated`
6. **Policy Definition:** `bucket_id = 'event-images'`
7. **USING Clause:** `bucket_id = 'event-images'`
8. **Save**

### Adım 2: artists Bucket'ı İçin
1. **Storage → artists → Policies**
2. **Create a new policy**
3. **Policy Name:** `Public Read Access`
4. **Allowed Operation:** `SELECT`
5. **Target Roles:** `anon, authenticated`
6. **Policy Definition:** `bucket_id = 'artists'`
7. **USING Clause:** `bucket_id = 'artists'`
8. **Save**

## Alternatif: Tam Policy SQL
Eğer dashboard'da olmazsa SQL Editor'da:

```sql
CREATE POLICY "Public Read Access for event-images" ON storage.objects 
FOR SELECT USING (bucket_id = 'event-images');

CREATE POLICY "Public Read Access for artists" ON storage.objects 
FOR SELECT USING (bucket_id = 'artists');
```

## Test Et
1. Turne yönetim sayfasına gidin
2. Sanatçı ekleme formunda resim yüklemeyi deneyin
3. Console'da hata mesajlarını kontrol edin

## Beklenen Sonuç
- ✅ Policy oluşturuldu
- ✅ Resim yükleme çalışır
- ✅ "Bucket not found" hatası kalkar
