# Panduan Deployment ke Website

Panduan lengkap untuk mendeploy aplikasi Manufacturing Process System ke server web.

## 📋 Daftar Isi

1. [Persiapan](#persiapan)
2. [Opsi Deployment](#opsi-deployment)
3. [Deployment ke VPS/Server](#deployment-ke-vpsserver)
4. [Deployment ke Cloud Platform](#deployment-ke-cloud-platform)
5. [Konfigurasi Domain & SSL](#konfigurasi-domain--ssl)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## 🛠️ Persiapan

### 1. Prerequisites

Pastikan Anda memiliki:
- ✅ Node.js v14+ terinstall
- ✅ npm atau yarn
- ✅ Git
- ✅ Akses ke server (VPS/Cloud)
- ✅ Domain name (opsional, untuk HTTPS)
- ✅ Odoo Session ID
- ✅ Credentials untuk Authenticity API (jika digunakan)

### 2. File yang Perlu Disiapkan

- ✅ File `.env` untuk environment variables
- ✅ Database SQLite (`warehouse_integrations.db`)
- ✅ Semua file project

---

## 🌐 Opsi Deployment

### Opsi 1: VPS/Server (Recommended untuk Production)
- **Platform:** DigitalOcean, AWS EC2, Linode, Vultr, dll
- **Kelebihan:** Full control, performa baik, biaya terjangkau
- **Kekurangan:** Perlu setup manual

### Opsi 2: Cloud Platform (PaaS)
- **Platform:** Heroku, Railway, Render, Fly.io
- **Kelebihan:** Mudah, auto-scaling, managed
- **Kekurangan:** Biaya lebih tinggi, kurang kontrol

### Opsi 3: Container Platform
- **Platform:** Docker + Docker Compose
- **Kelebihan:** Portable, mudah di-deploy di mana saja
- **Kekurangan:** Perlu pengetahuan Docker

---

## 🖥️ Deployment ke VPS/Server

### Langkah 1: Setup Server

#### 1.1. Connect ke Server
```bash
# SSH ke server
ssh user@your-server-ip
```

#### 1.2. Install Node.js
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (menggunakan NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

#### 1.3. Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

#### 1.4. Install Nginx (Reverse Proxy)
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Langkah 2: Deploy Aplikasi

#### 2.1. Clone atau Upload Project
```bash
# Opsi A: Clone dari Git
cd /var/www
sudo git clone https://github.com/your-username/UI_Warehouse_Production.git
sudo chown -R $USER:$USER UI_Warehouse_Production
cd UI_Warehouse_Production

# Opsi B: Upload via SCP/SFTP
# Upload semua file ke /var/www/UI_Warehouse_Production
```

#### 2.2. Install Dependencies
```bash
cd /var/www/UI_Warehouse_Production
npm install --production
```

#### 2.3. Setup Database
```bash
# Initialize database
node scripts/setup_db.js

# Run migrations
node scripts/migrate_add_auth.js
node scripts/migrate_add_api_keys.js
node scripts/migrate_add_ready_flag.js
node scripts/migrate_add_production_log.js
```

#### 2.4. Setup Environment Variables
```bash
# Buat file .env
nano .env
```

Isi dengan konfigurasi berikut:
```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Odoo Configuration
ODOO_API_URL=https://foomx.odoo.com
ODOO_SESSION_ID=your_session_id_here
ODOO_TIMEOUT_MS=30000

# Authenticity API Configuration
AUTH_BASE_URL=https://warehouse.foomid.id
AUTH_USERNAME=foom
AUTH_PASSWORD=foom
AUTH_TIMEOUT_MS=20000

# Database
SQLITE_PATH=/var/www/UI_Warehouse_Production/warehouse_integrations.db

# Sync Scheduler
SYNC_INTERVAL_MINUTES=5
AUTH_SYNC_INTERVAL_MINUTES=10

# Timezone (optional, default UTC+7)
TIMEZONE_OFFSET_MINUTES=420
```

**⚠️ PENTING:** Ganti `your_session_id_here` dengan Odoo Session ID yang valid!

#### 2.5. Setup PM2
```bash
# Start aplikasi dengan PM2
pm2 start ecosystem.config.js

# Atau start manual
pm2 start server.js --name warehouse-ui

# Save PM2 configuration
pm2 save

# Setup PM2 untuk auto-start saat reboot
pm2 startup
# Jalankan command yang ditampilkan (biasanya sudo ...)
```

#### 2.6. Monitor PM2
```bash
# Lihat status
pm2 status

# Lihat logs
pm2 logs warehouse-ui

# Restart aplikasi
pm2 restart warehouse-ui

# Stop aplikasi
pm2 stop warehouse-ui
```

### Langkah 3: Konfigurasi Nginx (Reverse Proxy)

> **💡 Tips:** Jika ingin menggunakan **subdomain** (misalnya `warehouse.yourdomain.com`), lihat panduan lengkap di [`SUBDOMAIN_SETUP.md`](SUBDOMAIN_SETUP.md)

#### 3.1. Buat Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/warehouse-production
```

Isi dengan:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    # Atau untuk subdomain: server_name warehouse.yourdomain.com;

    # Redirect HTTP to HTTPS (setelah setup SSL)
    # return 301 https://$server_name$request_uri;

    # Untuk sementara, proxy ke Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase timeout untuk long-running requests
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}
```

#### 3.2. Enable Site
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/warehouse-production /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Langkah 4: Setup Firewall
```bash
# Allow HTTP dan HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (jika belum)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## ☁️ Deployment ke Cloud Platform

### Opsi A: Railway

1. **Buat Akun Railway**
   - Kunjungi https://railway.app
   - Sign up dengan GitHub

2. **Create New Project**
   - Klik "New Project"
   - Pilih "Deploy from GitHub repo"
   - Pilih repository Anda

3. **Setup Environment Variables**
   - Di dashboard Railway, buka "Variables"
   - Tambahkan semua environment variables dari `.env`

4. **Deploy**
   - Railway akan otomatis detect Node.js
   - Build dan deploy otomatis

5. **Custom Domain (Opsional)**
   - Di settings, tambahkan custom domain
   - Railway akan generate SSL otomatis

### Opsi B: Render

1. **Buat Akun Render**
   - Kunjungi https://render.com
   - Sign up

2. **Create New Web Service**
   - Connect GitHub repository
   - Pilih branch (biasanya `main`)

3. **Configure**
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node

4. **Environment Variables**
   - Tambahkan semua variables di dashboard

5. **Deploy**
   - Render akan otomatis deploy

### Opsi C: Heroku

1. **Install Heroku CLI**
```bash
# Download dari https://devcenter.heroku.com/articles/heroku-cli
```

2. **Login & Create App**
```bash
heroku login
heroku create your-app-name
```

3. **Setup Environment Variables**
```bash
heroku config:set NODE_ENV=production
heroku config:set ODOO_API_URL=https://foomx.odoo.com
heroku config:set ODOO_SESSION_ID=your_session_id
# ... tambahkan semua variables
```

4. **Deploy**
```bash
git push heroku main
```

5. **Setup Database**
```bash
heroku run node scripts/setup_db.js
heroku run node scripts/migrate_add_auth.js
heroku run node scripts/migrate_add_api_keys.js
```

**⚠️ Catatan untuk Heroku:**
- Heroku menggunakan **ephemeral filesystem**, jadi SQLite database akan hilang saat restart
- **Rekomendasi:** Migrate ke PostgreSQL atau gunakan Heroku Postgres addon

---

## 🔒 Konfigurasi Domain & SSL

> **💡 Tips:** Untuk setup **subdomain**, lihat panduan lengkap di [`SUBDOMAIN_SETUP.md`](SUBDOMAIN_SETUP.md)

### Setup SSL dengan Let's Encrypt (Certbot)

#### 1. Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

#### 2. Generate SSL Certificate
```bash
# Untuk domain utama
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Untuk subdomain (contoh: warehouse.yourdomain.com)
sudo certbot --nginx -d warehouse.yourdomain.com
```

Certbot akan:
- Generate SSL certificate
- Otomatis update Nginx configuration
- Setup auto-renewal

#### 3. Update Nginx Config untuk HTTPS
```bash
sudo nano /etc/nginx/sites-available/warehouse-production
```

Uncomment redirect HTTP ke HTTPS:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 4. Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. Test Auto-Renewal
```bash
sudo certbot renew --dry-run
```

---

## 📊 Monitoring & Maintenance

### 1. Monitor Aplikasi dengan PM2
```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs warehouse-ui --lines 100

# View metrics
pm2 status
```

### 2. Setup Log Rotation
PM2 sudah include log rotation, tapi bisa dikonfigurasi:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 3. Backup Database
```bash
# Buat script backup
nano /var/www/UI_Warehouse_Production/backup.sh
```

Isi:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/warehouse-production"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp /var/www/UI_Warehouse_Production/warehouse_integrations.db \
   $BACKUP_DIR/warehouse_integrations_$DATE.db
# Hapus backup lebih dari 30 hari
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
```

```bash
chmod +x backup.sh

# Setup cron untuk auto-backup (setiap hari jam 2 pagi)
crontab -e
# Tambahkan:
0 2 * * * /var/www/UI_Warehouse_Production/backup.sh
```

### 4. Update Aplikasi
```bash
# Pull update dari Git
cd /var/www/UI_Warehouse_Production
git pull origin main

# Install dependencies baru (jika ada)
npm install --production

# Run migrations (jika ada)
node scripts/migrate_*.js

# Restart aplikasi
pm2 restart warehouse-ui
```

---

## 🔧 Troubleshooting

### Masalah: Aplikasi tidak bisa diakses

**Cek:**
1. Apakah aplikasi berjalan?
```bash
pm2 status
```

2. Apakah port 3000 listening?
```bash
sudo netstat -tlnp | grep 3000
# atau
sudo ss -tlnp | grep 3000
```

3. Cek logs
```bash
pm2 logs warehouse-ui
```

4. Cek Nginx
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### Masalah: Database locked

**Solusi:**
- Pastikan hanya satu instance aplikasi yang berjalan
- Restart aplikasi: `pm2 restart warehouse-ui`
- Cek apakah ada process lain yang menggunakan database

### Masalah: Odoo sync gagal

**Cek:**
1. Session ID masih valid?
   - Login ke Odoo web
   - Ambil session_id baru dari cookies
   - Update di `.env` atau environment variables

2. Koneksi internet?
```bash
curl https://foomx.odoo.com
```

3. Cek logs scheduler
```bash
pm2 logs warehouse-ui | grep -i sync
```

### Masalah: SSL certificate expired

**Solusi:**
```bash
# Renew manual
sudo certbot renew

# Cek auto-renewal
sudo certbot renew --dry-run
```

### Masalah: PM2 tidak auto-start

**Solusi:**
```bash
# Setup ulang startup script
pm2 unstartup
pm2 startup
# Jalankan command yang ditampilkan
pm2 save
```

---

## 🔐 Security Best Practices

### 1. Update System Regularly
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Setup Firewall
```bash
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
```

### 3. Secure SSH
```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Use key-based authentication
# Generate key pair di local
ssh-keygen -t rsa -b 4096
ssh-copy-id user@your-server

# Disable password authentication (setelah key setup)
# Set: PasswordAuthentication no

sudo systemctl restart sshd
```

### 4. Protect Environment Variables
- Jangan commit `.env` ke Git
- Gunakan environment variables di platform deployment
- Rotate API keys secara berkala

### 5. Database Security
- Backup database secara berkala
- Jangan expose database port ke public
- Gunakan strong passwords untuk database (jika migrate ke PostgreSQL/MySQL)

---

## 📝 Checklist Deployment

- [ ] Server/VPS sudah setup
- [ ] Node.js dan npm terinstall
- [ ] PM2 terinstall
- [ ] Nginx terinstall dan dikonfigurasi
- [ ] Aplikasi sudah di-deploy
- [ ] Database sudah di-setup
- [ ] Environment variables sudah dikonfigurasi
- [ ] PM2 sudah running dan auto-start
- [ ] Nginx sudah dikonfigurasi sebagai reverse proxy
- [ ] Firewall sudah dikonfigurasi
- [ ] Domain sudah di-point ke server IP
- [ ] SSL certificate sudah di-generate
- [ ] Backup database sudah di-setup
- [ ] Monitoring sudah dikonfigurasi
- [ ] Aplikasi bisa diakses via domain

---

## 🆘 Support

Jika mengalami masalah:
1. Cek logs: `pm2 logs warehouse-ui`
2. Cek Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Cek dokumentasi di `README.md` dan `LOCAL_DEPLOYMENT.md`
4. Buat issue di GitHub repository

---

**Last Updated:** Desember 2024
**Version:** 1.0.0

