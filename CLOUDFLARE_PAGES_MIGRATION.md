# Cloudflare Pages Migration Guide - Bilet Ekosistemi

## 🎯 Neden Cloudflare Pages?

### Avantajları
- **CPU Limitleri**: Daha geniş ve anlık limit yok
- **Edge Network**: 300+ global lokasyon
- **Ücretsiz**: Cömert ücretsiz plan
- **Daha Ucuz**: Pro plan daha uygun fiyatlı
- **DDoS Koruması**: Built-in güçlü koruma
- **Analytics**: Detaylı ücretsiz analytics

### Vercel vs Cloudflare Pages

| Özellik | Vercel (Ücretsiz) | Cloudflare Pages (Ücretsiz) |
|---------|------------------|---------------------------|
| CPU Limit | 10s/day (anlık 1s) | Daha esnek |
| Bandwidth | 100GB/month | 500GB/month |
| Edge Functions | 100k requests/day | 500k requests/day |
| Build Time | 6000 minutes/month | Sınırsız |
| Analytics | Temel | Detaylı |

## 🚀 Migration Stratejisi

### 1. Mevcut Yapı Analizi
```bash
# Proje yapısı kontrol
C:\bilet-ekosistemi
├── next.config.mjs
├── src/
├── public/
└── package.json
```

### 2. Cloudflare Pages Setup

#### A. Cloudflare Dashboard
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) giriş
2. **Workers & Pages** → **Create application** → **Pages**
3. **Connect to Git** seçin

#### B. Git Integration
```bash
# Git repository kontrol
cd C:\bilet-ekosistemi
git status
```

#### C. Build Settings
```
Framework preset: Next.js
Build command: npm run build
Build output directory: .next
```

### 3. Environment Variables
Cloudflare Pages'de şu environment variables'ı ekleyin:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_key
TICKET_EMAIL_FROM=your_email
NEXT_PUBLIC_SITE_URL=your_site_url
SENTRY_DSN=your_sentry_dsn (opsiyonel)
```

### 4. Next.js Konfigürasyonu Değişiklikleri

#### A. next.config.mjs Güncellemesi
```javascript
// next.config.mjs
const nextConfig = {
  // Cloudflare Pages için optimizasyonlar
  output: 'export', // Eğer full static export kullanmak isterseniz
  // Veya default: server-side rendering
  
  trailingSlash: true,
  
  // Cloudflare için image optimization
  images: {
    unoptimized: true, // Cloudflare native image optimization kullan
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dzncmwjffopednfgjwlo.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  
  // Cloudflare Edge Functions için
  edge: {
    config: {
      runtime: 'edge',
    },
  },
};
```

#### B. Middleware Adaptasyonu
Cloudflare Pages middleware desteği sınırlı. Middleware mantığını yeniden düzenlememiz gerekebilir:

```typescript
// src/middleware-cloudflare.ts (alternatif)
export const onRequest: PagesFunction = async (context) => {
  // Cloudflare Pages-specific middleware logic
  const url = new URL(context.request.url);
  
  // Basit redirect ve locale handling
  if (url.pathname === '/') {
    return Response.redirect(`${url.origin}/tr`);
  }
  
  return context.next();
};
```

### 5. Supabase Connection Güncellemesi

```typescript
// lib/supabase-cloudflare.ts
import { createClient } from '@supabase/supabase-js';

export function createCloudflareSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
    global: {
      headers: {
        'Connection': 'keep-alive',
      },
    },
  });
}
```

### 6. ISR ve Static Export Seçenekleri

#### Option A: Full Static Export (En hızlı)
```javascript
// next.config.mjs
export default {
  output: 'export',
  images: {
    unoptimized: true,
  },
};
```

**Avantajları:**
- En hızlı yüklenme
- Sınırsız CPU
- En düşük maliyet

**Dezavantajları:**
- Dinamik özellikler kısıtlı
- Real-time özellikler çalışmaz

#### Option B: Hybrid (Önerilen)
```javascript
// next.config.mjs
export default {
  // SSR + ISR
  images: {
    unoptimized: false,
  },
};
```

**Avantajları:**
- Dinamik özellikler korunur
- ISR ile cache optimization
- CPU kullanımı optimize

### 7. Cron Jobs Çözümü

Cloudflare Pages cron job desteği sınırlı. Alternatifler:

#### Option A: Cloudflare Workers Cron
```typescript
// E-posta hatırlatıcı için Cloudflare Worker
export default {
  async scheduled(event, env, ctx) {
    // Her gün 09:00 çalışır
    const { data } = await env.SUPABASE.from('events').select('*');
    // E-posta gönderme logic
  },
};
```

#### Option B: Supabase Edge Functions
```typescript
// Supabase Edge Function: send-reminders
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { events } = await supabase.from('events').select('*');
  // E-posta gönder
  return new Response("OK");
});
```

### 8. Deployment Komutları

```bash
# Git'e gönder
cd C:\bilet-ekosistemi
git add .
git commit -m "Cloudflare Pages migration preparation"
git push origin main

# Cloudflare otomatik deploy yapacak
```

### 9. DNS Ayarları

```
1. Cloudflare DNS'e git
2. A record oluştur: kurdevents.com → Pages deployment URL
3. SSL sertifikası otomatik (Let's Encrypt)
```

### 10. Test ve Validasyon

```bash
# Local test
npm run build
npm run start

# Cloudflare Pages preview
# Her PR için otomatik preview URL oluştur
```

## 🔧 Common Issues ve Çözümler

### Issue 1: Image Optimization
```javascript
// Cloudflare native image optimization kullan
<Image 
  src={image} 
  alt={alt}
  width={800}
  height={600}
  unoptimized // Cloudflare'da native optimizasyon
/>
```

### Issue 2: Middleware Sınırlamaları
```typescript
// Pages Functions kullan
// functions/[[path]].ts
export async function onRequest(context) {
  // Middleware logic buraya taşı
  return context.next();
}
```

### Issue 3: Environment Variables
```bash
# Cloudflare Pages Settings → Environment Variables
# Production ve Preview ortamları için ayrı ayarlar
```

### Issue 4: Build Hataları
```bash
# Node versiyonu kontrol
node --version # v18+ gerekiyor

# Dependencies kontrol
npm ci
```

## 📊 Performans Karşılaştırması

### Vercel (Mevcut)
- CPU Limit: 10s/day
- Response Time: 200-500ms
- Uptime: 99.9%
- Maliyet: Ücretsiz (sınırlı)

### Cloudflare Pages (Beklenen)
- CPU Limit: Daha esnek
- Response Time: 50-200ms (Edge)
- Uptime: 99.99%
- Maliyet: Ücretsiz (daha cömert)

## 🎯 Migration Roadmap

### Phase 1: Preparation (1-2 gün)
- [ ] Cloudflare hesabı oluştur
- [ ] Git repository kontrol
- [ ] Environment variables hazırla
- [ ] Next.js config'i güncelle

### Phase 2: Test Deployment (1 gün)
- [ ] Staging environment oluştur
- [ ] Test deployment yap
- [ ] Fonksiyonları test et
- [ ] Performans ölç

### Phase 3: Production Migration (1 gün)
- [ ] DNS ayarları
- [ ] Production deploy
- [ ] SSL sertifikası
- [ ] Monitoring kurulumu

### Phase 4: Post-Migration (3-5 gün)
- [ ] Cron job'ları taşı
- [ ] Analytics kurulumu
- [ ] Performance monitoring
- [ ] Eski sistem kaldır

## 🚀 Alternatif: Cloudflare Workers + Pages

Karma çözüm:
- **Cloudflare Pages**: Frontend (Next.js)
- **Cloudflare Workers**: API endpoints ve cron jobs
- **Cloudflare KV**: Cache ve session storage

```typescript
// workers/api/events.ts
export default {
  async fetch(request, env, ctx) {
    const events = await env.SUPABASE.from('events').select('*');
    return Response.json(events);
  },
};
```

## 💰 Maliyet Analizi

### Vercel Pro ($20/ay)
- 100GB bandwidth
- 1TB edge cache
- 1000 GB-hours compute

### Cloudflare Pages Pro ($20/ay)
- 500GB bandwidth
- Unlimited edge cache
- 10M workers requests
- Daha fazla CPU

**Sonuç**: Cloudflare Pages daha değer.

## 🎯 Tavsiye

**Önce Cloudflare Pages'e geçiş yapın.** CPU limit sorunlarınız büyük ölçüde çözülecek. Eğer hala sorun yaşarsanız:

1. Cloudflare Workers ile API'leri ayırın
2. Supabase Edge Functions kullanın
3. Vercel Pro plan düşünün (en son çare)

## 📞 Destek

Cloudflare Pages dokümantasyonu: https://developers.cloudflare.com/pages/