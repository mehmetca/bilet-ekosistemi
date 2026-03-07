# Vercel’de Yönetim Paneli Girişi

Vercel’de site açılıyor ama **yönetim paneline giremiyorsanız** aşağıdakileri kontrol edin.

---

## 1. Vercel ortam değişkenleri

Vercel → Proje → **Settings** → **Environment Variables** bölümünde şunlar tanımlı olmalı:

- `NEXT_PUBLIC_SUPABASE_URL`  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
- (İsteğe bağlı) `SUPABASE_SERVICE_ROLE_KEY` (bazı API’ler için)

Değişiklik yaptıysanız **Redeploy** yapın.

---

## 2. Supabase: Site URL ve Redirect URLs

Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** Vercel sitenizin adresi (örn. `https://bilet-ekosistemi-xxx.vercel.app`)
- **Redirect URLs:** Aynı adresi ekleyin, örn. `https://bilet-ekosistemi-xxx.vercel.app/**`
  - Google ile giriş için: `https://bilet-ekosistemi-xxx.vercel.app/auth/callback` adresini de ekleyin

Bunlar yanlışsa oturum / cookie davranışı bozulabilir.

---

## 3. `user_roles` tablosu ve RLS

Yönetim paneline giriş, `user_roles` tablosundaki **admin** veya **controller** rolüne bağlı.

- **Tablo:** `user_roles` (en azından `user_id`, `role` sütunları)
- Giriş yaptığınız kullanıcının **Supabase Auth UID**’si için bu tabloda bir satır olmalı ve `role` değeri `admin` veya `controller` olmalı.

**RLS (Row Level Security):**

- `user_roles` tablosunda RLS açıksa, kullanıcının **kendi satırını** okuyabilmesi gerekir.
- Örnek policy (Supabase SQL Editor’da çalıştırabilirsiniz):

```sql
-- user_roles için: giriş yapan kullanıcı kendi satırını okuyabilsin
CREATE POLICY "Users can read own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);
```

Eğer bu policy yoksa veya `user_id` eşleşmiyorsa, uygulama rolü alamaz ve yönetim paneline giremez.

---

## 4. Admin kullanıcıyı ekleme

Supabase Dashboard → **Authentication** → **Users** ile giriş yaptığınız kullanıcının **UUID**’sini kopyalayın.

Supabase → **Table Editor** → `user_roles` → **Insert row**:

- `user_id`: Bu UUID  
- `role`: `admin`

Kaydettikten sonra sitede tekrar giriş yapıp `/yonetim` sayfasını deneyin.

---

## 5. Hâlâ giremiyorsanız

- Giriş sayfasında (**/giris**) e-posta/şifre veya Google ile giriş yapın.
- Girişten sonra “Yönetim paneline erişim yetkiniz yok” mesajı görüyorsanız: giriş **çalışıyor**, sorun rol/yetki veya `user_roles`/RLS.
- Doğrudan giriş sayfasına atılıyorsanız: oturum tutulmuyor; 1. ve 2. adımları (env, Site URL, Redirect URLs) tekrar kontrol edin.

---

## 6. “Resim yüklenemedi” / “Bucket not found” (local ve Vercel)

Yönetim panelinde (sanatçı, etkinlik vb.) resim yüklerken **Bucket not found** veya **Resim yüklenemedi** alıyorsanız: Resimler **Supabase Storage**’a yüklenir ve **`uploads`** adında bir bucket gerekir. Bu bucket’ı **bir kez** oluşturmanız yeterli; hem local hem Vercel aynı Supabase projesini kullandığı için ikisi de çalışır.

**Yapmanız gereken:**

1. **[supabase.com](https://supabase.com)** → projenizi açın
2. Sol menüden **Storage** → **New bucket**
3. **Name:** tam olarak **`uploads`** yazın (küçük harf)
4. **Public bucket** kutusunu işaretleyin (resimlerin sitede görünmesi için)
5. **Create bucket** tıklayın

**Local için:** `.env.local` içinde `SUPABASE_SERVICE_ROLE_KEY` tanımlı olsun (Supabase → Settings → API → `service_role` secret).

**Vercel için:** Proje → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` ekleyin, gerekirse Redeploy yapın.

Bucket’ı oluşturduktan sonra resim yükleme hem bilgisayarınızda hem Vercel’de çalışır.
