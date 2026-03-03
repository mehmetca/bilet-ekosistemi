# Supabase Storage Policy Doğru Syntax

## Hatalı Syntax
```sql
bucket_id = (SELECT id FROM buckets WHERE name = 'event-images')
```

## Doğru Syntax
```sql
bucket_id = 'event-images'
```

## Supabase Dashboard'da Policy Oluşturma

### Adım 1: event-images Bucket'ı İçin
1. **Storage → event-images → Policies**
2. **Create a new policy**
3. **Policy Name:** `Public Read Access`
4. **Allowed Operation:** `SELECT`
5. **Target Roles:** `anon, authenticated`
6. **Policy Definition:** `bucket_id = 'event-images'`
7. **Save**

### Adım 2: artists Bucket'ı İçin
1. **Storage → artists → Policies**
2. **Create a new policy**
3. **Policy Name:** `Public Read Access`
4. **Allowed Operation:** `SELECT`
5. **Target Roles:** `anon, authenticated`
6. **Policy Definition:** `bucket_id = 'artists'`
7. **Save**

## Alternatif: Bucket Name Kullanımı
Eğer bucket_id çalışmazsa:
```sql
bucket.name = 'event-images'
```

## Test Et
1. Turne yönetim sayfasına gidin
2. Sanatçı ekleme formunda resim yüklemeyi deneyin
3. Console'da hata mesajlarını kontrol edin

## Beklenen Sonuç
- ✅ Policy oluşturuldu
- ✅ Resim yükleme çalışır
- ✅ "Bucket not found" hatası kalkar
