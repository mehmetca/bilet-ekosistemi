# Bilet Ekosistemi Migration Timeline - Vercel → Contabo VPS 6

## 🎯 Genel Bakış

**Toplam Tahmini Süre: 2-5 gün** (karmaşıklığa göre)

### Migration Hazırlık Faktörleri
- ✅ **Supabase kullanıyorsunuz** → Database migration gerekmiyor
- ✅ **Next.js 14** → Modern deployment
- ⚠️ **Cron job'lar var** → Yeniden yapılandırma gerekli
- ⚠️ **Stripe webhooks** → Endpoint URL güncellemesi gerekli
- ⚠️ **DNS değişikliği** → Propagation süresi

## 📊 Detaylı Timeline

### Phase 1: Hazırlık (4-8 saat)

#### 1.1 Sunucu Kurulumu (1-2 saat)
```
- Contabo VPS 6 siparişi: 15-30 dakika
- Ubuntu 22.04 kurulumu: 15-30 dakika
- Docker + Coolify kurulumu: 30-60 dakika
- SSL sertifikası: 15-30 dakika
- Firewall ayarları: 15-30 dakika
```

#### 1.2 Environment Variables Hazırlığı (30-60 dakika)
```
- Vercel'den environment variables export: 15-30 dakika
- Contabo environment variables yapılandırma: 15-30 dakika
- Secret keys transfer: 15-30 dakika
```

#### 1.3 Codebase Hazırlığı (1-2 saat)
```
- Next.js config güncellemeleri: 30-60 dakika
- Production build test: 30-60 dakika
- Dependencies kontrol: 15-30 dakika
```

**Phase 1 Toplamı: 4-8 saat**

### Phase 2: Deployment (2-4 saat)

#### 2.1 Coolify Setup (1-2 saat)
```
- Coolify kurulumu: 30-60 dakika
- Git repository bağlantısı: 15-30 dakika
- Build configuration: 15-30 dakika
- Environment variables set-up: 15-30 dakika
```

#### 2.2 İlk Deployment (1-2 saat)
```
- `npm run build`: 5-15 dakika
- `npm start`: 2-5 dakika
- Health check: 15-30 dakika
- Log kontrol: 15-30 dakika
```

**Phase 2 Toplamı: 2-4 saat**

### Phase 3: Testing & Validation (4-8 saat)

#### 3.1 Functionality Testing (2-4 saat)
```
- Ana sayfa yükleniyor mu: 15-30 dakika
- Login/registration çalışıyor mu: 30-60 dakika
- Bilet satın alma flow: 30-60 dakika
- Stripe entegrasyonu: 30-60 dakika
- Admin panel fonksiyonları: 30-60 dakika
```

#### 3.2 Performance Testing (1-2 saat)
```
- Response time test: 15-30 dakika
- Load test (100 users): 30-60 dakika
- Database connection test: 15-30 dakika
```

#### 3.3 Security Testing (1-2 saat)
```
- SSL sertifika kontrol: 15-30 dakika
- Firewall rules test: 15-30 dakika
- API endpoint security: 30-60 dakika
```

**Phase 3 Toplamı: 4-8 saat**

### Phase 4: DNS Migration (1-3 gün)

#### 4.1 DNS Hazırlığı (1-2 saat)
```
- Mevcut DNS export: 15-30 dakika
- Yeni DNS planlama: 30-60 dakika
- DNS record update: 15-30 dakika
```

#### 4.2 DNS Propagation (24-72 saat)
```
- Global DNS propagation: 24-72 saat
- TTL etkisi: 0-24 saat
- Cache temizleme: Manuel müdahale
```

#### 4.3 Monitoring (Gönlük)
```
- Uptime monitoring: 24 saat
- Error log kontrol: Manuel
- Performance monitoring: Manuel
```

**Phase 4 Toplamı: 1-3 gün**

### Phase 5: Post-Migration (2-4 saat)

#### 5.1 Stripe Webhook Güncellemesi (30-60 dakika)
```
- Stripe dashboard'da webhook URL güncelleme: 15-30 dakika
- Webhook signature güncelleme: 15-30 dakika
```

#### 5.2 Cron Job Yapılandırması (1-2 saat)
```
- Vercel cron job'lar kaldırma: 15-30 dakika
- Contabo/Supabase cron job'lar kurma: 30-60 dakika
- Test ve validation: 15-30 dakika
```

#### 5.3 Monitoring Setup (30-60 dakika)
```
- Uptime monitoring kurulumu: 15-30 dakika
- Error tracking setup: 15-30 dakika
```

**Phase 5 Toplamı: 2-4 saat**

## 🎯 Toplam Süre Özeti

### Hızlı Migration (Minimum Süre)
```
Phase 1: 4 saat
Phase 2: 2 saat
Phase 3: 4 saat
Phase 4: 24 saat (DNS propagation)
Phase 5: 2 saat
─────────────────────────
Toplam: 36 saat (1.5 gün)
```

### Standart Migration (Normal Süre)
```
Phase 1: 6 saat
Phase 2: 3 saat
Phase 3: 6 saat
Phase 4: 48 saat (DNS propagation)
Phase 5: 3 saat
─────────────────────────
Toplam: 66 saat (2.75 gün)
```

### Detaylı Migration (Maximum Süre)
```
Phase 1: 8 saat
Phase 2: 4 saat
Phase 3: 8 saat
Phase 4: 72 saat (DNS propagation)
Phase 5: 4 saat
─────────────────────────
Toplam: 96 saat (4 gün)
```

## ⚡ Süre İyileştirme Önerileri

### 1. Hazırlık Öncesi (Şimdi Yapın)
- ✅ Environment variables hazır hale getirin
- ✅ Git repository clean yapın
- ✅ Backup planı hazırlayın
- ✅ Test script'leri hazırlayın

### 2. Parallel İşlemler
- ✅ Sunucu kurulumu + Code hazırlığı (paralel)
- ✅ Testing + SSL sertifikası (paralel)
- ✅ Monitoring + Stripe webhook (paralel)

### 3. Test Ortamı Kullanın
- ✅ Önce staging environment test edin
- ✅ Production migration'ı sırasında minimum downtime

### 4. DNS Propagation Hızlandırma
- ✅ TTL değerlerini düşürün (önceden)
- ✅ Cloudflare kullanıyorsanız faster propagation
- ✅ Manual cache temizleme

## 🚨 Riskler ve Çözümler

### Risk 1: DNS Propagation Gecikmesi
**Süre Riski**: +24-48 saat
**Çözüm**: Cloudflare DNS kullanın, TTL düşürün

### Risk 2: Build Hataları
**Süre Riski**: +2-4 saat
**Çözüm**: Local build test, staging environment

### Risk 3: Database Migration Sorunları
**Süre Riski**: +4-8 saat
**Çözüm**: Supabase kullanıyorsunuz, migration gerekmiyor

### Risk 4: SSL Sertifika Sorunları
**Süre Riski**: +1-2 saat
**Çözüm**: Let's Encrypt otomatik kurulum

### Risk 5: Stripe Webhook Hataları
**Süre Riski**: +1-2 saat
**Çözüm**: Önce test webhook endpoint'i

## 🎯 Minimum Downtime Stratejisi

### 1. Blue-Green Deployment
```
1. Yeni sunucu kur
2. DNS'i yeni sunucuya yönlendir
3. Eski sunucuyu kapat
Downtime: 0-5 dakika
```

### 2. DNS A/B Testing
```
1. Yeni sunucu kur
2. DNS'i %50-50 split
3. Test ve validation
4. Full migration
Downtime: 0-10 dakika
```

### 3. Load Balancer
```
1. Yeni sunucu kur
2. Load balancer ekle
3. Trafiği yavaşça yeni sunucuya taşı
Downtime: 0 dakika
```

## 📊 Vercel → Contabo Migration Checklist

### Hazırlık (Önce)
- [ ] Contabo VPS 6 siparişi
- [ ] Ubuntu 22.04 kurulumu
- [ ] Docker + Coolify kurulumu
- [ ] Environment variables export
- [ ] Git repository clean
- [ ] Backup planı hazır

### Deployment (Sırasında)
- [ ] Coolify project oluştur
- [ ] Git repository bağla
- [ ] Build configuration yap
- [ ] İlk deployment yap
- [ ] Health check
- [ ] SSL sertifikası

### Testing (Sonrasında)
- [ ] Functionality test
- [ ] Performance test
- [ ] Security test
- [ ] Stripe webhook test
- [ ] Cron job test

### DNS Migration (Final)
- [ ] DNS record update
- [ ] DNS propagation izle
- [ ] Cache temizleme
- [ ] Monitoring kurulumu

## 🎯 Final Tavsiye

### Hazırlık Süresi: 1 gün (önceden yapılabilir)
### Migration Süresi: 1-2 gün (gerçek migration)
### DNS Propagation: 1-3 gün (otomatik)
### Toplam: 2-5 gün

**En hızlı senaryo:**
- Hazırlık önceden yapın
- Weekend migration planlayın
- DNS propagation bekleyin
- Toplam: 2 gün

**En güvenli senaryo:**
- Detaylı test yapın
- Staging environment kullanın
- Blue-green deployment
- Toplam: 4-5 gün