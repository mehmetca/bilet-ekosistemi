# Netcup vs Contabo vs Hetzner - Bilet Ekosistemi Karşıştırması

## 🎯 Bilet Ekosistemi İhtiyaçları

### Gereksinler
- **Next.js 14**: Modern React framework, SSR ve ISR gerektirir
- **Supabase**: Veritabanı, auth, storage (mevcut kullanıyorsunuz)
- **CPU**: Anlık limit yok, yüksek kullanım zamanı
- **RAM**: 8GB+ (Node.js + cache + processes için)
- **Storage**: SSD tercih edilir (görseller, PDF'ler için)
- **Network**: Stabil uptime, düşük latency
- **Bandwidth**: Yüksek trafik potansiyeli
- **Support**: Kararlı ve hızlı

### Kullanım Patternleri
- Etkinlik bilet satışı (anlık koltuk durumu)
- PDF bilet generation (CPU yoğun)
- Real-time seat selection (WebSocket)
- Admin panel ve dashboard
- Cron job'lar (e-posta hatırlatıcıları)
- Upload/Download işlemleri

## 📊 Detaylı Karşılaştırma

### 1. Netcup VPS Serisi

#### Avantajları
- **Alman hosting**: Alman veri koruma yasalarına uyumlu
- **12 ay kontrat**: Sabit fiyat (inflation koruması)
- **KVM virtualization**: İyi performans
- **Hourly billing**: Esnek kullanım
- **DDoS koruma**: Opsiyonel ücretsiz
- **DDR5 ECC RAM**: Daha stabil
- **NVMe SSD**: Hızlı I/O

#### Dezavantajları
- **Shared vCPU**: Paylaşımlı CPU (bazı planlarda)
- **Kesin contract**: 12 ay zorunlu (hourly opsiyonu daha pahalı)
- **Interface speed**: Düşük (VPS Lite planlarında)
- **Uptime SLA**: VPS'te root server SLA'si yok (99.9% guaranteed yok)

#### Öne Çıkan Planlar
| Plan | vCPU | RAM | Storage | Maliyet | CPU Tipi |
|------|------|-----|--------|---------|----------|
| **VPS Lite 2 G12s** | 4 | 8GB | 160GB SSD | €7.92 | Shared |
| **VPS 1000 G12** | 4 | 8GB | 256GB NVMe | €10.36 | Shared |
| **VPS 2000 G12** | 8 | 16GB | 512GB NVMe | €19.25 | Shared |

### 2. Contabo Cloud VPS

#### Avantajları
- **Alman hosting**: Alman veri koruma yasalarına uyumlu
- **Dedicated vCPU**: Tam CPU erişimi (shared değil)
- **Snapshots**: Built-in backup sistemi
- **Scalability**: Kaynak artırımı kolay
- **No hidden costs**: Şeffaf fiyatlandırma
- **DDoS koruma**: Ücretsiz
- **High network ports**: 1Gbit/s (yüksek planlarda)

#### Dezavantajları
- **24 ay kampanya fiyatı**: Sonra artabilir
- **Bandwidth limits**: "Exceptionally high usage" throttle riski
- **CPU**: "Previous generation" (en yeni değil)
- **Support**: 24/7 support yok (iş saatleri)

#### Öne Çıkan Planlar
| Plan | vCPU | RAM | Storage | Maliyet | Network |
|------|------|-----|--------|---------|---------|
| **Cloud VPS 6** | 6 | 12GB | 200GB SSD | €7.50 | 300 Mbit/s |
| **Cloud VPS 8** | 8 | 24GB | 300GB SSD | €14.00 | 600 Mbit/s |
| **Cloud VPS 12** | 12 | 48GB | 400GB SSD | €25.00 | 800 Mbit/s |

### 3. Hetzner Cloud CX

#### Avantajları
- **Alman hosting**: Alman veri koruma yasalarına uyumlu
- **En yeni Intel CPU**: En son nesil CPU'lar
- **Hourly billing**: Esnek, taahhüt yok
- **20TB bandwidth**: Çok cömert
- **Dedicated vCPU**: Tam CPU erişimi
- **NVMe SSD**: En hızlı storage
- **High network**: 1Gbit/s (tüm planlarda)
- **Community**: Büyük topluluk, iyi dokümantasyon

#### Dezavantajları
- **No phone support**: Sadece email support
- **Deprecation riski**: Eski planlar zamanla kaldırılıyor
- **Scaling**: Vertical scaling limitleri
- **Billing**: Euro olarak (kur riski)

#### Öne Çıkan Planlar
| Plan | vCPU | RAM | Storage | Maliyet | Network |
|------|------|-----|--------|---------|---------|
| **CX22** | 2 | 4GB | 40GB NVMe | €3.79 | 20TB |
| **CX32** | 4 | 8GB | 80GB NVMe | €9.20* | 20TB |
| **CX42** | 8 | 16GB | 160GB NVMe | €16.40 | 20TB |
| **CX52** | 16 | 32GB | 320GB | €32.40 | 20TB |

*Fiyat bölgesel olarak değişebilir, resmi site'den kontrol edin: https://www.hetzner.com/cloud/pricing/

## 🎯 Bilet Ekosistemi İçin Analiz

### CPU Performansı

| Sağlayıcı | CPU Tipi | Next.js Performansı | Anlık Limit |
|----------|---------|------------------|------------|
| **Netcup VPS** | Shared (VPS) | İyi | ortalı var |
| **Contabo VPS** | Dedicated | Çok iyi | yok |
| **Hetzner CX** | Dedicated | En iyi | yok |

### RAM Yeterliliği

| Sağlayıcı | RAM | Next.js + Supabase | Yeterli Mi? |
|----------|-----|-------------------|-----------|
| **Netcup VPS Lite 2** | 8GB | ~6GB kullanır | ✅ Yeterli |
| **Contabo VPS 6** | 12GB | ~8GB kullanır | ✅ Yeterli |
| **Hetzner CX32** | 8GB | ~6GB kullanır | ✅ Yeterli |

### Storage Performansı

| Sağlayıcı | Storage Tipi | Next.js için | Yeterli Mi? |
|----------|------------|--------------|-----------|
| **Netcup** | NVMe (G12) / SSD (Lite) | NVMe: ✅ | ✅ Yeterli |
| **Contabo** | SSD | SSD: ✅ | ✅ Yeterli |
| **Hetzner** | NVMe | NVMe: ✅ | ✅ En iyi |

### Network Performansı

| Sağlayıcı | Bandwidth | Network | Next.js için |
|----------|-----------|--------|--------------|
| **Netcup** | 2.5Gbit/s (G12) | Çok iyi | ✅ İdeal |
| **Contabo** | 1Gbit/s (yüksek plan) | İyi | ✅ İdeal |
| **Hetzner** | 20TB/ay (shared) | Çok iyi | ✅ İdeal |

## 💰 Maliyet Karşılaştırması

### Benzer Specs Karşıştırması

#### 4 vCPU / 8GB RAM Seviyesi
| Sağlayıcı | Plan | Maliyet | Aylık CPU Maliyet |
|----------|------|---------|----------------|
| **Netcup VPS Lite 2** | €7.92 | €7.92 | €1.98/vCPU |
| **Contabo VPS 4** | €5.50 (24 ay) | €5.50 | €1.38/vCPU |
| **Hetzner CX32** | €6.80 | €6.80 | €1.70/vCPU |

#### 8 vCPU / 16GB RAM Seviyesi
| Sağlayıcı | Plan | Maliyet | Aylık CPU Maliyet |
|----------|------|---------|----------------|
| **Netcup VPS 2000** | €19.25 | €19.25 | €2.41/vCPU |
| **Contabo VPS 12** | €25.00 (24 ay) | €25.00 | €2.08/vCPU |
| **Hetzner CX42** | €16.40 | €16.40 | €2.05/vCPU |

## ⚠️ Risk Analizi

### Netcup Riskleri
1. **Shared CPU**: Peak saatlerde performans düşüşü
2. **12 ay contract**: Esneklik yok
3. **Uptime SLA**: 99.9% guaranteed yok
4. **Support**: Sınırlı saatler

### Contabo Riskleri
1. **Kampanya sonrası fiyat artışı**: €5.50 → €? (belirsiz)
2. **Bandwidth throttle**: "Exceptionally high usage" riski
3. **24 saat support yok**: Gece sorunları
4. **CPU yaşlı**: En yeni değil

### Hetzner Riskleri
1. **Deprecation**: Eski planlar kaldırılıyor
2. **Support**: Email only (yavaş)
3. **Scaling**: Vertical limitleri
4. **Fiyat dalgalanması**: Euro riski

## 🎯 Tavsiye Kararı

### En İyi Değer: **Hetzner CX32**
**Neden?**
- ✅ €6.80/ay (en ucuz)
- ✅ 4 vCPU (tam kontrol)
- ✅ 8GB RAM (yeterli)
- ✅ 80GB NVMe (hızlı storage)
- ✅ 20TB bandwidth (çok cömert)
- ✅ En yeni CPU
- ✅ Hourly billing (esnek)
- ✅ Büyük topluluk

### İkinci Seçenek: **Contabo VPS 6**
**Neden?**
- ✅ €7.50/ay (değerli)
- ✅ 6 vCPU (daha fazla)
- ✅ 12GB RAM (daha cömert)
- ✅ 200GB SSD (yeterli)
- ✅ Dedicate CPU (shared değil)
- ✅ Snapshots (backup kolaylığı)
- ✅ Alman hosting

### Üçüncü Seçenek: **Netcup VPS 1000 G12**
**Neden?**
- ✅ €10.37/ay (orta seviye)
- ✅ 4 vCPU (kontroll)
- ✅ 8GB RAM (yeterli)
- ✅ 256GB NVMe (en hızlı)
- ✅ DDR5 ECC RAM (stabil)
- ✅ 2.5Gbit/s network
- ✅ 12 ay sabit fiyat

## 🎯 Netcup VPS Lite 1 G12s Analizi

### Özellikler
- **CPU**: 2 vCPU (x86) - Shared
- **RAM**: 4GB DDR5 ECC
- **Storage**: 80GB SSD (NVMe değil)
- **Network**: 500 Mbps (düşük interface speed)
- **Maliyet**: €4.88/ay (19% KDV dahil)
- **Kontrat**: Esnek (Netcup'te minimum contract period yoktur)

### Bilet Ekosistemi İçin Yeterlilik Analizi

#### CPU Performansı
- **2 vCPU**: Next.js için minimum düzey
- **Shared CPU**: Peak saatlerde performans düşüşü riski
- **PDF generation**: CPU yoğun, time-out riski
- **Real-time seat selection**: Latency sorunları

#### RAM Yeterliliği
- **4GB RAM**: Next.js + Supabase için sıkışık
- **Node.js processes**: ~2-3GB
- **OS + Cache**: ~1GB
- **Kalan**: ~0GB (kritik seviye)

#### Storage Performansı
- **80GB SSD**: Yeterli ama NVMe değil
- **I/O performansı**: NVMe'den daha yavaş
- **Upload/Download**: Bilet PDF'leri için yavaş olabilir

#### Network Performansı
- **500 Mbps**: Diğer planlara göre düşük
- **Trafik spike'leri**: Bottle-neck olabilir
- **Concurrent users**: Yüksek trafikte sorun

### Karar: **Uygun Değil**

#### Neden Uygun Değil?
1. **RAM yetersiz**: 4GB Next.js için kritik seviye
2. **CPU düşük**: 2 vCPU PDF generation için yetersiz
3. **Network yavaş**: 500 Mbps bottleneck riski
4. **NVMe yok**: SSD performansı yetersiz
5. **Shared CPU**: Peak saatlerde sorun

### Alternatif: VPS Lite 2 G12s

#### Özellikler
- **CPU**: 4 vCPU (x86) - Shared
- **RAM**: 8GB DDR5 ECC
- **Storage**: 160GB SSD
- **Network**: 750 Mbps
- **Maliyet**: €7.92/ay (19% KDV dahil)

#### Bilet Ekosistemi İçin
- ✅ **CPU**: 4 vCPU = kabul edilebilir
- ✅ **RAM**: 8GB = yeterli
- ✅ **Storage**: 160GB = iyi
- ⚠️ **Network**: 750 Mbps = kabul edilebilir
- **Toplam**: **Uygun olabilir**

### Tavsiye: **VPS Lite 2 G12s Kullanın**

**Neden?**
- 4 vCPU (VPS Lite 1'den 2x daha fazla)
- 8GB RAM (VPS Lite 1'den 2x daha fazla)
- 160GB storage (VPS Lite 1'den 2x daha fazla)
- 750 Mbps network (VPS Lite 1'den daha hızlı)
- €7.92/ay (sadece €3.04 fark)

## 🎯 Contabo VPS 6 vs VPS Lite 2 G12s - Final Karar

### Bilet Ekosistemi İçin Net Karşılaştırma

| Özellik | Contabo VPS 6 | VPS Lite 2 G12s | Kazanan |
|--------|---------------|----------------|---------|
| **CPU** | 6 vCPU (Dedicated) | 4 vCPU (Shared) | 🥇 Contabo |
| **RAM** | 12GB | 8GB | 🥇 Contabo |
| **Storage** | 200GB SSD | 160GB SSD | 🥇 Contabo |
| **Network** | 300 Mbit/s | 750 Mbps | 🥈 VPS Lite |
| **Maliyet** | €7.50 (24 ay) | €7.92 | 🥇 Contabo |
| **CPU Tipi** | Dedicated | Shared | 🥇 Contabo |
| **Snapshots** | 2 built-in | Copy-On-Write | 🤝 Beraber |

### 🎯 Final Tavsiye: **Contabo VPS 6**

**Neden Contabo VPS 6?**

1. **6 vCPU Dedicated** - Bilet işlemleri için kritik
   - PDF generation: İyi performans
   - Real-time seat selection: Düşük latency
   - Peak saatlerde sorun yok

2. **12GB RAM** - Next.js için ideal
   - Cömert headroom
   - Cache için space
   - Scaling için hazırlıklı

3. **€7.50 Maliyet** - Daha ucuz
   - VPS Lite 2'den €0.42 daha ucuz
   - Daha fazla kaynak

4. **Dedicated CPU** - Shared CPU sorunları yok
   - Predictable performance
   - Resource contention yok

### ⚠️ Contabo VPS 6 İçin Uyarılar

1. **24 ay kampanya riski** - Fiyat artabilir
2. **Network speed düşük** - 300 Mbit/s bottleneck riski
3. **Support süreleri** - 24/7 support yok

## 🚀 Bilet Ekosistemi İçin Final Tavsiye

### 🥇 **Hetzner CX32 (En İdeal)**
- **Maliyet**: €6.80/ay (~$7.50)
- **Performans**: En iyi CPU/price oranı
- **Esneklik**: Hourly billing
- **Stability**: En yeni donanım
- **Scalability**: Easy upgrade path

### 🥈 **Contabo VPS 6 (İyi Alternatif)**
- **Maliyet**: €7.50/ay (24 ay sonra artabilir)
- **Performans**: Daha fazla vCPU (6 vs 4)
- **RAM**: Daha cömert (12GB vs 8GB)
- **Backup**: Built-in snapshots
- **Risk**: Kampanya sonrası fiyat artışı

### 🥉 **Netcup VPS 1000 G12 (Güvenli Seçenek)**
- **Maliyet**: €10.37/ay
- **Stabilite**: 12 ay sabit fiyat
- **Performans**: DDR5 ECC RAM (çok stabil)
- **Risk**: Shared CPU (peak saatlerde düşüş)

## 🎯 Sorun Çıkarma İhtimaları

### En Az Sorun: **Hetzner CX32**
- ✅ CPU limitleri yok
- ✅ En yeni donanım
- ✅ Büyük topluluk desteği
- ✅ Esnek contract
- ❌ Tek dezavantaj: Email support (yavaş)

### Orta Sorun: **Contabo VPS 6**
- ✅ Dedicated CPU
- ✅ Built-in snapshots
- ✅ Daha fazla vCPU
- ⚠️ Kampanya sonrası fiyat artışı riski
- ⚠️ 24 saat support yok

### En Çok Sorun: **Netcup VPS 1000 G12**
- ✅ 12 ay sabit fiyat
- ✅ DDR5 ECC RAM (çok stabil)
- ⚠️ Shared CPU (peak saatlerde performans düşüşü)
- ⚠️ Uptime SLA yok
- ⚠️ 12 ay contract (esneklik yok)

## 🎯 Final Karar

### **Hetzner CX32** - En İdeal Seçim
**Neden?**
- En iyi CPU/price oranı
- Sınırsız CPU kullanımı
- En yeni donanım
- Esnek hourly billing
- Büyük topluluk desteği
- **CPU limit sorunu kesin çözülür**

### Bilet Ekosistemi Performans Beklentisi (Hetzner CX32)
- **1000 concurrent user**: ✅ Rahat
- **5000 concurrent user**: ✅ Kabul edilebilir
- **10.000 concurrent user**: ⚠️ Upgrade gerekli (CX42'e)

### Öneri
**Hetzner CX32 ile başlayın, sorun yaşarsanız Contabo VPS 6'ya geçin.**