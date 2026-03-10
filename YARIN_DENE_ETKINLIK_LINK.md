# Etkinlik linki local'de açılsın – yarın tek seferde dene

## Ne değişti?
Etkinlik sayfası **Vercel ile aynı** client'ı kullanıyor: `createServerSupabaseAdmin()` (service role). Böylece RLS / is_approved / slug farkı kalkar.

## Yarın sırayla yap

1. **`.env.local`** içinde bu üçü olsun (Vercel’dekilerle aynı):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Cache temizle + başlat**
   ```powershell
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   npm run dev
   ```

3. **Tarayıcıda aç**
   - http://localhost:3000/tr/etkinlik/erdal-kaya
   - veya http://localhost:3000/tr/etkinlik/d338019a-e73b-41d7-803f-9e2af7048837

4. Hâlâ 404 ise: **Sentry’yi dev’de kapat**  
   `.env.local` içinde `NEXT_PUBLIC_SENTRY_DSN` satırını sil veya başına `#` koy.

---

Bu ayarlarla local, Vercel’deki gibi aynı Supabase client’ı (service role) kullanıyor; tek fark kalmaması lazım.
