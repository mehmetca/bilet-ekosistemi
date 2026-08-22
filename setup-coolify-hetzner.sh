#!/bin/bash
# Coolify + Hetzner CX22 Kurulum Script'i
# Bu script'i sunucuya upload edip çalıştırın

set -e

echo "=== Coolify + Hetzner CX22 Kurulum Başlıyor ==="

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}1. Sistem Güncellemeleri${NC}"
apt update && apt upgrade -y

echo -e "${GREEN}2. Docker Kurulumu${NC}"
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

echo -e "${GREEN}3. Docker Compose Kurulumu${NC}"
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

echo -e "${GREEN}4. Sistem Optimizasyonları${NC}"
# Kernel tuning
cat >> /etc/sysctl.conf <<EOF
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
EOF
sysctl -p

# File descriptors
cat >> /etc/security/limits.conf <<EOF
* soft nofile 65535
* hard nofile 65535
EOF

echo -e "${GREEN}5. Firewall Kurulumu${NC}"
apt install ufw -y
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Coolify (opsiyonel)
ufw --force enable

echo -e "${GREEN}6. Coolify Kurulumu${NC}"
mkdir -p /opt/coolify
cd /opt/coolify

# Coolify Docker Compose
wget https://raw.githubusercontent.com/coollabsio/coolify/master/docker-compose.yml

echo -e "${GREEN}7. Coolify Başlatma${NC}"
docker-compose up -d

echo -e "${GREEN}8. Monitoring Kurulumu${NC}"
# Uptime Kuma (opsiyonel)
docker run -d --name uptime-kuma -p 3001:3001 -v uptime-kuma:/app/data louislam/uptime-kuma:latest

echo -e "${GREEN}9. Backup Script Kurulumu${NC}"
cat > /root/backup.sh <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /backups/$DATE

# Coolify data backup
tar -czf /backups/$DATE/coolify-data.tar.gz /opt/coolify/data

# 7 gün eski backup'ları sil
find /backups -type d -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $DATE"
EOF

chmod +x /root/backup.sh

# Cron job ekle (haftada bir backup)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup.sh") | crontab -

echo -e "${GREEN}10. Nginx Kurulumu (Opsiyonel)${NC}"
apt install nginx -y

cat > /etc/nginx/sites-available/kurdevents <<EOF
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

ln -s /etc/nginx/sites-available/kurdevents /etc/nginx/sites-enabled/
nginx -t
systemctl enable nginx
systemctl start nginx

echo -e "${YELLOW}11. SSL Sertifikası (Coolify içinde yapılandırın)${NC}"
echo "Coolify dashboard'da domain ekleyin ve SSL otomatik yapılandırın"

echo -e "${GREEN}=== Kurulum Tamamlandı ===${NC}"
echo -e "${YELLOW}Coolify Dashboard: http://$(hostname -I | cut -d' ' -f2):3000${NC}"
echo -e "${YELLOW}Uptime Kuma: http://$(hostname -I | cut -d' ' -f2):3001${NC}"
echo -e "${YELLOW}Backup script: /root/backup.sh${NC}"
echo -e "${YELLOW}Nginx configuration: /etc/nginx/sites-available/kurdevents${NC}"