# Coolify + Hetzner CX22 Setup Guide - Bilet Ekosistemi

## 🎯 Neden Coolify + Hetzner?

### Coolify Avantajları
- **Open Source**: Tam kontrol, vendor lock-in yok
- **Self-Hosted**: Kendi sunucunuzda barındırın
- **Kolay Deployment**: Git push ile otomatik deploy
- **Built-in Database**: PostgreSQL, Redis, MongoDB desteği
- **SSL Otomatik**: Let's Encrypt sertifikaları
- **Monitoring**: Built-in monitoring ve logging
- **No CPU Limits**: Sunucu kaynakları kadar kullanabilirsiniz

### Hetzner CX Sunucu Özellikleri (Güncel Fiyatlar 2024)

#### CX22 (Entry Level - En Ucuz)
- **CPU**: 2 vCPU (Intel)
- **RAM**: 4GB
- **Storage**: 40GB NVMe SSD
- **Bandwidth**: 20TB/ay
- **Aylık Maliyet**: €3.79 (~$4.20)
- **Saatlik**: €0.0060

#### CX32 (Orta Seviye)
- **CPU**: 4 vCPU (Intel)
- **RAM**: 8GB
- **Storage**: 80GB NVMe SSD
- **Bandwidth**: 20TB/ay
- **Aylık Maliyet**: €6.80 (~$7.50)
- **Saatlik**: €0.0113

#### CX42 (Yüksek Performans)
- **CPU**: 8 vCPU (Intel)
- **RAM**: 16GB
- **Storage**: 160GB NVMe SSD
- **Bandwidth**: 20TB/ay
- **Aylık Maliyet**: €16.40 (~$18.20)
- **Saatlik**: €0.0273

#### CX52 (En Yüksek)
- **CPU**: 16 vCPU (Intel)
- **RAM**: 32GB
- **Storage**: 320GB NVMe SSD
- **Bandwidth**: 20TB/ay
- **Aylık Maliyet**: €32.40 (~$36.00)
- **Saatlik**: €0.0540

### Maliyet Karşılaştırması

| Platform | Aylık Maliyet | CPU | RAM | Kontrol |
|----------|---------------|-----|-----|---------|
| **Vercel Pro** | $20 (~€18) | Sınırlı | - | Yok |
| **Cloudflare Pro** | $20 (~€18) | Sınırlı | - | Sınırlı |
| **Coolify + Hetzner CX22** | €35-45 | 8 vCPU* | 32GB | Tam |
| **DigitalOcean 8GB** | $48 (~€44) | 4 vCPU | 8GB | Tam |

*Hetzner'de anlık CPU limiti yok, kullanılabilir.

### Bilet Ekosistemi İçin Tavsiye

**CX22 (€3.79/ay):**
- 2 vCPU, 4GB RAM
- Mevcut kullanım için yeterli
- En ucuz başlangıç

**CX32 (€6.80/ay):**
- 4 vCPU, 8GB RAM  
- Optimal denge
- Büyüme için iyi

**CX42 (€16.40/ay):**
- 8 vCPU, 16GB RAM
- Yüksek performans
- Gerçekçi ölçekleme

## 🚀 Kurulum Stratejisi

### Phase 1: Hetzner Sunucu Kurulumu

#### 1. Hetzner Hesabı Oluşturma
1. [Hetzner Cloud](https://www.hetzner.com/) kayıt olun
2. Payment method ekleyin (kredi kartı veya PayPal)
3. €10 kredit ile başlayın

#### 2. CX Sunucu Oluşturma
```bash
Location: Nuremberg (en iyi latency için)
Image: Ubuntu 22.04 LTS

# Öneri: CX32 (dengeli performans/maliyet)
Type: CX32 (vCPU: 4, RAM: 8GB, Disk: 80GB NVMe)
Maliyet: €6.80/ay

# Veya: CX22 (en ucuz başlangıç)
Type: CX22 (vCPU: 2, RAM: 4GB, Disk: 40GB NVMe)  
Maliyet: €3.79/ay

# Veya: CX42 (yüksek performans)
Type: CX42 (vCPU: 8, RAM: 16GB, Disk: 160GB NVMe)
Maliyet: €16.40/ay

SSH Key: Public key'inizi ekleyin
Firewall: SSH (22) + HTTP (80) + HTTPS (443)
```

#### 3. DNS Ayarları
```
A Record: kurdevents.com → Hetzner IP
AAAA Record: kurdevents.com → Hetzner IPv6 (opsiyonel)
```

### Phase 2: Coolify Kurulumu

#### Method A: Docker ile Kurulum (Önerilen)
```bash
# Sunucuya SSH ile bağlanın
ssh root@your-hetzner-ip

# Sistem güncellemeleri
apt update && apt upgrade -y

# Docker kurulumu
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose kurulumu
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Coolify kurulumu
mkdir -p /opt/coolify
cd /opt/coolify

# Coolify Docker Compose
wget https://raw.githubusercontent.com/coollabsio/coolify/master/docker-compose.yml
docker-compose up -d
```

#### Method B: Script ile Kurulum
```bash
# Coolify otomatik kurulum script'i
curl -fsSL https://cdn.coollabs.io/coolify/install.sh -o install.sh
chmod +x install.sh
./install.sh
```

#### Method C: Coolify CLI
```bash
# Coolify CLI kurulumu
npm install -g @coolify/cli

# CLI ile kurulum
coolify install
```

### Phase 3: Next.js Project Kurulumu

#### 1. Coolify Dashboard Erişim
```
http://your-hetzner-ip:3000
Initial setup: Admin kullanıcı oluştur
```

#### 2. Project Oluşturma
```
1. "New Project" → "Next.js"
2. Git repository'nizi bağlayın
3. Build command: npm run build
4. Start command: npm start
5. Environment variables ekleyin
```

#### 3. Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_key
TICKET_EMAIL_FROM=your_email
NEXT_PUBLIC_SITE_URL=https://kurdevents.com
SENTRY_DSN=your_sentry_dsn
NODE_ENV=production
```

#### 4. Database Kurulumu (Opsiyonel)
```
Coolify içinde PostgreSQL veya Redis oluşturabilirsiniz
Ya da mevcut Supabase kullanmaya devam edebilirsiniz
```

## 🔧 Optimizasyon Ayarları

### 1. Hetzner Sunucu Optimizasyonu

#### A. Kernel Tuning
```bash
# /etc/sysctl.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
```

#### B. File Descriptors
```bash
# /etc/security/limits.conf
* soft nofile 65535
* hard nofile 65535
```

#### C. Nginx Reverse Proxy (Opsiyonel)
```nginx
# /etc/nginx/sites-available/kurdevents
server {
    listen 80;
    server_name kurdevents.com www.kurdevents.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Coolify Project Optimizasyonu

#### A. Node.js Memory
```bash
# Environment variable
NODE_OPTIONS=--max-old-space-size=8192
```

#### B. Build Optimization
```javascript
// next.config.mjs
export default {
  // Coolify için optimizasyonlar
  output: 'standalone', // Self-hosted için ideal
  compress: true,
  swcMinify: true,
  
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};
```

#### C. Process Manager
```bash
# Coolify otomatik process management sağlar
# Restart policy, health checks built-in
```

### 3. Next.js Production Optimizasyonu

#### A. Caching Strategy
```typescript
// lib/cache.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCachedData(key: string, ttl: number) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchDataFromDB();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

#### B. Database Connection Pooling
```typescript
// lib/supabase-server.ts
export function createServerSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    db: {
      schema: "public",
    },
    global: {
      headers: {
        'Connection': 'keep-alive',
      },
    },
    // Connection pool settings
  });
}
```

## 🔒 Güvenlik Ayarları

### 1. SSH Güvenliği
```bash
# Root login disabled
Password authentication disabled
SSH key only
```

### 2. Firewall Rules
```bash
# UFW (Uncomplicated Firewall)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Coolify (opsiyonel)
ufw enable
```

### 3. SSL Sertifikası
```bash
# Coolify otomatik Let's Encrypt sertifikası sağlar
# Domain'inizi Coolify'a ekleyin
# SSL otomatik yapılandırılır
```

### 4. Database Security
```bash
# PostgreSQL firewall (Coolify içinde)
# Sadece uygulama sunucusundan erişim
# Şifreli connection strings
```

## 📊 Performans Beklentileri

### CX22 + Next.js Tahmini Performans

| Metrik | Beklenen Değer |
|--------|----------------|
| **Response Time** | 50-150ms (Optimize edilmiş) |
| **Concurrent Users** | 10.000+ (8 vCPU ile) |
| **Database Connections** | 200+ (32GB RAM ile) |
| **Bandwidth** | 1Gbit/s (sınırsız kullanım) |
| **Uptime** | 99.9% (sadece sunucu bakımı) |

### Load Testing Sonuçları (Tahmini)
```
1000 concurrent users:
- Response time: 80-120ms
- CPU usage: 40-60%
- RAM usage: 8-12GB
- ✅ Kararlı

5000 concurrent users:
- Response time: 150-250ms  
- CPU usage: 70-85%
- RAM usage: 18-24GB
- ⚠️ Optimize edilmeli

10000 concurrent users:
- Response time: 300-500ms
- CPU usage: 90-95%
- RAM usage: 28-30GB
- ❌ Daha güçlü sunucu gerekli
```

## 🎯 Sürüdürülebilirlik Analizi

### CPU Kullanımı
**Soru**: CPU limitleri tükenecek mi?
**Cevap**: ❌ HAYIR - Anlık CPU limiti yok

**Detaylar:**
- Hetzner'de anlık CPU limiti yok
- 8 vCPU tam kullanılabilir
- Sadece toplam aylık kullanım fiyatlandırılır
- Burst usage mümkün

### Memory Kullanımı
**Soru**: 32GB RAM yeterli mi?
**Cevap**: ✅ EVET - Çok cömert

**Detaylar:**
- Next.js + Node.js: ~2-4GB
- PostgreSQL (Coolify): ~8-12GB
- Redis (Cache): ~2-4GB
- OS + Diğer: ~4-8GB
- **Toplam**: ~16-28GB (kalan headroom)

### Storage Kullanımı
**Soru**: 480GB SSD yeterli mi?
**Cevap**: ✅ EVET - Çok cömert

**Detaylar:**
- Next.js build: ~500MB
- Logs: ~1-2GB
- Uploads: Supabase'de (kullanıyorsunuz)
- Backup: ~50-100GB
- **Kalan**: ~300GB+ headroom

### Network Bandwidth
**Soru**: 1Gbit/s yeterli mi?
**Cevap**: ✅ EVET - Çok yüksek

**Detaylar:**
- 1Gbit/s = 125MB/s
- 1000 user × 2MB PDF = 2GB/sn (1.6% bandwidth)
- 10.000 user × 2MB PDF = 20GB/sn (16% bandwidth)
- **Sonuç**: Çok geniş headroom

## ⚠️ Olası Sorunlar ve Çözümler

### 1. Initial Setup Complexity
**Sorun**: Teknik bilgi gerektirir
**Çözüm**: Detaylı guide ve script'ler

### 2. Maintenance Responsibility
**Sorun**: Sunucu yönetimi gerekiyor
**Çözüm**: Coolify automation + Monitoring

### 3. DDoS Koruması
**Sorun**: Hetzner'in built-in DDoS koruması sınırlı
**Çözüm**: Cloudflare CDN/Proxy kullanın

### 4. Backup Strategy
**Sorun**: Manual backup gerekiyor
**Çözüm**: Automated backup solutions

### 5. SSL Certificate Management
**Sorun**: Manuel renewal gerekebilir
**Çözüm**: Coolify otomatik Let's Encrypt

### 6. Scaling Limitations
**Sorun**: Vertical scaling limitleri
**Çözüm**: Multi-server architecture

### 7. Support Eksikliği
**Sorun**: Self-hosted = official support yok
**Çözüm**: Community support + Monitoring

## 🛡️ Üretim Hazırlığı

### 1. Monitoring Kurulumu
```bash
# Uptime Kuma (ücretsiz)
docker run -d --name uptime-kuma -p 3001:3001 -v uptime-kuma:/app/data louislam/uptime-kuma:latest

# Grafana + Prometheus (opsiyonel)
# Coolify built-in monitoring kullan
```

### 2. Backup Strategy
```bash
# Automated backup script
#!/bin/bash
# /root/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /backups/$DATE

# Database backup
pg_dump -U postgres -d coolify > /backups/$DATE/coolify_db.sql

# Project files backup
tar -czf /backups/$DATE/projects.tar.gz /opt/coolify/data

# 7 gün eski backup'ları sil
find /backups -type d -mtime +7 -exec rm -rf {} \;
```

### 3. Security Hardening
```bash
# Fail2ban
apt install fail2ban -y

# Anti-virus (opsiyonel)
apt install clamav -y

# Security updates
apt install unattended-upgrades -y
```

### 4. Disaster Recovery Plan
```bash
# Snapshot before major changes
# Hetzner panel'de snapshot oluştur
# Rolling backup strategy
```

## 🚀 Deployment Process

### 1. Development
```bash
# Local development
npm run dev

# Test locally
```

### 2. Staging
```bash
# Coolify staging environment
git push staging
# Otomatik deploy
```

### 3. Production
```bash
# Coolify production environment
git push main
# Otomatik deploy
# Zero downtime (coolify rolling update)
```

## 📊 Maliyet Analizi

### Toplam Maliyet
```
Hetzner CX22: €3.79/ay (en ucuz başlangıç)
Hetzner CX32: €6.80/ay (önerilen)
Hetzner CX42: €16.40/ay (yüksek performans)
Coolify: Ücretsiz (self-hosted)
Backup storage: €2-5/ay (opsiyonel)
SSL: Ücretsiz (Let's Encrypt)
─────────────────────────
Toplam (CX32): €6.80-€12/ay (~$7.50-$13/ay)
```

### Kıyasla
- **Vercel Pro**: $20/ay (CPU limitli)
- **Cloudflare Pro**: $20/ay (CPU limitli)  
- **Coolify + Hetzner**: €45/ay (limitsiz)

### 3 Yıl Maliyet
```
Vercel Pro: $720
Cloudflare Pro: $720
Coolify + Hetzner CX22: €136.56 (~$150)
Coolify + Hetzner CX32: €244.80 (~$270)
Coolify + Hetzner CX42: €590.40 (~$655)
```

**Not**: Coolify + Hetzner CX32 en iyi değer/performans oranı sunar!

## 🎯 Risk Analizi

### Risk 1: Setup Complexity (Yüksek)
**Olabilirlik**: %90
**Etki**: Kurulum zaman alabilir
**Çözüm**: Detaylı guide + script'ler

### Risk 2: Maintenance Load (Orta)
**Olabilirlik**: %60
**Etki**: Sürekli monitoring gerekli
**Çözüm**: Automation + alerting

### Risk 3: DDoS Vulnerability (Orta)
**Olabilirlik**: %40
**Etki**: DDoS saldırıları
**Çözüm**: Cloudflare Proxy

### Risk 4: Scaling Limits (Düşük)
**Olabilirlik**: %20
**Etki**: Vertical scaling limitleri
**Çözüm**: Multi-server architecture

### Risk 5: Support Eksikliği (Düşük)
**Olabilirlik**: %30
**Etki**: Sorun çözümü yavaş
**Çözüm**: Community + Monitoring

## ✅ Avantajları (Vercel/Cloudflare ile Karşılaştırma)

### 1. CPU Limitleri
- ❌ Vercel: 10s/day limit
- ❌ Cloudflare: Anlık limit
- ✅ Coolify + Hetzner: **Sınırsız**

### 2. Control
- ❌ Vercel: Sınırlı
- ❌ Cloudflare: Sınırlı
- ✅ Coolify + Hetzner: **Tam kontrol**

### 3. Database
- ❌ Vercel: Supabase (ayrı maliyet)
- ❌ Cloudflare: Supabase (ayrı maliyet)
- ✅ Coolify + Hetzner: **Built-in PostgreSQL**

### 4. Cron Jobs
- ❌ Vercel: Native cron
- ❌ Cloudflare: Sınırlı cron
- ✅ Coolify + Hetzner: **Full cron desteği**

### 5. SSL
- ✅ Vercel: Otomatik
- ✅ Cloudflare: Otomatik
- ✅ Coolify + Hetzner: **Otomatik**

### 6. Custom Domain
- ✅ Vercel: Ücretsiz
- ✅ Cloudflare: Ücretsiz
- ✅ Coolify + Hetzner: **Ücretsiz**

## 🎯 Final Tavsiye

### Kısa Vadeli (Setup Phase: 1-2 hafta)
**Coolify + Hetzner test et:**
1. Hetzner CX22 sunucu kiralayın
2. Coolify kurun
3. Bilet ekosistemi deploy edin
4. Performance test edin

### Orta Vadeli (Migration Phase: 2-4 hafta)
**Production geçiş:**
1. DNS migration
2. Data migration
3. Testing ve validation
4. Monitoring kurulumu

### Uzun Vadeli (Scaling Phase: 3+ ay)
**Optimization:**
1. Performance monitoring
2. Scaling strategy belirle
3. Multi-server plan (gerekirse)

## 🚀 Alternatif: Hybrid Approach

**Coolify + Hetzner + Cloudflare:**
- **Coolify + Hetzner**: Application server
- **Cloudflare**: CDN + DDoS protection
- **Result**: En güvenli ve performanslı setup

```nginx
# Cloudflare → Hetzner architecture
1. Cloudflare CDN: Static assets cache
2. Cloudflare WAF: DDoS protection  
3. Hetzner: Dynamic content generation
4. Coolify: Application management
```

## 💰 ROI Analizi

### 6 Ay Sonu
```
Vercel Pro: $120
Coolify + Hetzner: €270 (~$297)
Fark: +$177
```

### 2 Yıl Sonu
```
Vercel Pro: $480
Coolify + Hetzner: €1080 (~$1188)
Fark: +$708
```

**Not**: Coolify + Hetzner başlangıçta daha pahalı ama 2. yıldan sonra karlı olabilir.

## 🎯 Final Karar

### Coolify + Hetzner CX22 Tavsiye Edilir Eğer:
- ✅ CPU limitlerinden kurtulmak istiyorsanız
- ✅ Tam kontrol istiyorsanız
- ✅ Teknik bilginiz var
- ✅ Maintenance yükünü kabul ediyorsunuz
- ✅ Long-term düşünüyorsunuz

### Vercel/Cloudflare Tavsiye Edilir Eğer:
- ✅ Kurulum kolaylığı önemli
- ✅ Maintenance yükü istemiyorsunuz
- ✅ Short-term düşünüyorsunuz
- ✅ Support hızlı erişim istiyorsunuz

## 📞 Ek Kaynaklar

- [Coolify Documentation](https://coolify.io/docs)
- [Hetzner Cloud Docs](https://docs.hetzner.com)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Self-Hosted Best Practices](https://awesome-selfhosted.net/)