# Vercel CPU Limit Çözümleri - Bilet Ekosistemi

## 🎯 Temel Sorun
Next.js 14 + Supabase + Vercel ücretsiz planda CPU limitlerine takılıyor.

## 📊 Mevcut Durum Analizi
- **Framework**: Next.js 14 (App Router)
- **Backend**: Supabase
- **Platform**: Vercel (ücretsiz plan)
- **Middleware**: Karmaşık i18n + auth mantığı
- **API Routes**: 40+ farklı endpoint
- **Cron Jobs**: E-posta hatırlatıcıları

## 🚀 Öncelikli Çözümler

### 1. Middleware Optimizasyonu
Middleware çok CPU yoğun çalışıyor. Şu optimizasyonları yapın:

```typescript
// middleware.ts - caching ekleyin
const maintenanceCache = new Map<string, {enabled: boolean, timestamp: number}>();
const CACHE_DURATION = 60000; // 1 dakika

async function resolveMaintenanceModeWithCache(cookieValue?: string) {
  const cacheKey = cookieValue || 'default';
  const cached = maintenanceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return { enabled: cached.enabled };
  }
  
  const result = await resolveMaintenanceMode(cookieValue);
  maintenanceCache.set(cacheKey, { enabled: result.enabled, timestamp: Date.now() });
  return result;
}
```

### 2. API Route'ları Edge'e Taşıma
Supabase client'ı kullanmayan API'ları Edge runtime'a taşıyın:

```typescript
// Örnek: api/events/route.ts
export const runtime = "edge";

export async function GET(request: NextRequest) {
  // Edge runtime'de daha hızlı çalışır
  // CPU limitinden etkilenmez
}
```

### 3. React Server Components Kullanımı
İstemci tarafı işlemleri sunucu tarafına taşıyın:

```typescript
// component.tsx
export default async function EventList() {
  const events = await getEvents(); // Sunucu tarafında çalışır
  
  return (
    <div>
      {events.map(event => <EventCard key={event.id} event={event} />)}
    </div>
  );
}
```

### 4. Supabase Sorgu Optimizasyonu
```typescript
// Cache katmanı ekleyin
const queryCache = new Map<string, {data: any, timestamp: number}>();

export async function getEventsWithCache() {
  const cacheKey = 'events-all';
  const cached = queryCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < 30000) { // 30 saniye
    return cached.data;
  }
  
  const { data } = await supabase.from('events').select('*');
  queryCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

### 5. ISR (Incremental Static Regeneration)
Statik sayfaları ISR ile güncelleyin:

```typescript
// app/[locale]/events/page.tsx
export const revalidate = 300; // 5 dakikada bir güncelle

export async function generateStaticParams() {
  return [{ locale: 'tr' }, { locale: 'de' }];
}
```

### 6. Database Connection Pooling
Supabase connection pool kullanın:

```typescript
// lib/supabase-server.ts
export function createServerSupabase(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: SERVER_ANON_AUTH,
    db: { 
      schema: "public",
      // Connection pool optimizasyonu
    },
    global: {
      headers: {
        'Connection': 'keep-alive'
      }
    }
  });
}
```

### 7. CDN Cache Ayarları
```javascript
// next.config.mjs
headers: async () => {
  return [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=60, stale-while-revalidate=30'
        }
      ]
    }
  ]
}
```

### 8. Bundle Optimizasyonu
```javascript
// next.config.mjs
experimental: {
  optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  // Mevcut ayarlarınız zaten var
}
```

### 9. Cron Job'ları Dış Platforma Taşıma
Vercel Cron Jobs yerine Supabase Edge Functions kullanın:

```typescript
// Supabase Edge Function: send-reminders
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Hatırlatma e-postaları gönder
  return new Response("OK");
});
```

### 10. Vercel Pro Upgrade
Ücretsiz plan sınırlarını aşmak için:
- **Pro Plan**: $20/ay (daha yüksek CPU limitleri)
- **Enterprise**: Özel çözümler

## 🔧 Uygulama Sırası

1. **Acil (Bugün):**
   - Middleware caching ekle
   - ISR enable et
   - CDN cache headers ekle

2. **Kısa Vadede (Bu Hafta):**
   - API route'ları edge'e taşı
   - Supabase sorgu cache'i ekle
   - React Server Components kullan

3. **Orta Vadede (Bu Ay):**
   - Cron job'ları Supabase'a taşı
   - Database connection pooling
   - Bundle optimizasyon

4. **Uzun Vadede:**
   - Vercel Pro plan'a geçiş
   - Dedicated hosting çözümleri

## 📈 Monitoring

Vercel Analytics'i kullanarak CPU kullanımını izleyin:
- En çok CPU tüketen endpoint'leri belirleyin
- Peak zamanları analiz edin
- Cache hit ratio'yi izleyin

## 🎯 Önerilen İlk Adım

En etkili çözüm: **Middleware caching + ISR + CDN headers**

Bu üç değişiklik anında %60-70 CPU azalması sağlayabilir.

## 💰 Maliyet Analizi

- **Ücretsiz Plan**: CPU limitleri sıkı
- **Pro Plan ($20/ay)**: 10x CPU limitleri
- **Kendi Sunucu**: Tam kontrol ama yönetim maliyeti

## 🚀 Alternatif Platformlar

Vercel yerine düşünebileceğiniz platformlar:
- **Railway**: Benzer fiyat, daha esnek CPU
- **Render**: Good free tier
- **Fly.io**: Edge deployment desteği
- **DigitalOcean**: Tam kontrol, daha ucuz