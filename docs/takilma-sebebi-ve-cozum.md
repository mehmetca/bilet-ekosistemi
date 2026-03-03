# Takılma Sorununun Kök Nedeni ve Çözümü

## Tespit Edilen Sorun

**Supabase-js bilinen deadlock hatası:** `onAuthStateChange` callback'i içinde async Supabase API çağrısı (postgREST, storage, vb.) yapıldığında, **sonraki tüm Supabase çağrıları** (getSession, setSession, from().select() vb.) **sonsuza kadar takılıyor**.

### Kaynak
- [Supabase Docs - Why is my supabase API call not returning?](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0)
- [GitHub Issue #762 - supabase/auth-js](https://github.com/supabase/gotrue-js/issues/762)

### Bizim Kodda
`SimpleAuthContext.tsx` içinde `onAuthStateChange` callback'inde:
```javascript
await fetchUserRole(session.user.id, ...)  // supabase.from("user_roles").select()
```
Bu çağrı deadlock'a neden oluyordu.

## Uygulanan Çözüm

1. **onAuthStateChange callback'inden async Supabase çağrısı kaldırıldı**
   - `fetchUserRole` artık callback içinde **await** edilmiyor
   - `setTimeout(0)` ile bir sonraki event loop tick'ine ertelendi
   - Böylece callback senkron dönüyor, lock serbest kalıyor

2. **Login sayfası**
   - `setSession` için 12 sn timeout eklendi
   - `router.replace` yerine `window.location.href` (tam sayfa yönlendirme)

## Sonuç
- Giriş yapılıyor takılması giderildi
- Yönetim paneli Yükleniyor takılması giderildi
- Oturum kurulumu zaman aşımı azaltıldı
