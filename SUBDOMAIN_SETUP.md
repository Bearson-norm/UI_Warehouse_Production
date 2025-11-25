# Panduan Setup Subdomain

Panduan lengkap untuk menggunakan subdomain untuk aplikasi Manufacturing Process System.

## 📋 Daftar Isi

1. [Setup DNS untuk Subdomain](#setup-dns-untuk-subdomain)
2. [Konfigurasi Nginx untuk Subdomain](#konfigurasi-nginx-untuk-subdomain)
3. [Setup SSL untuk Subdomain](#setup-ssl-untuk-subdomain)
4. [Multiple Subdomain di Server yang Sama](#multiple-subdomain-di-server-yang-sama)
5. [Troubleshooting](#troubleshooting)

---

## 🌐 Setup DNS untuk Subdomain

### Langkah 1: Tentukan Subdomain

Pilih subdomain yang ingin digunakan, contoh:
- `warehouse.yourdomain.com`
- `production.yourdomain.com`
- `mps.yourdomain.com`
- `dashboard.yourdomain.com`

### Langkah 2: Setup DNS Record

Masuk ke **DNS Provider** Anda (Cloudflare, Namecheap, GoDaddy, dll) dan tambahkan **A Record**:

#### Contoh di Cloudflare:
1. Login ke Cloudflare Dashboard
2. Pilih domain Anda
3. Klik **DNS** → **Records**
4. Klik **Add record**
5. Isi:
   - **Type:** `A`
   - **Name:** `warehouse` (atau subdomain yang Anda pilih)
   - **IPv4 address:** `YOUR_SERVER_IP` (IP server Anda)
   - **Proxy status:** `DNS only` (atau `Proxied` jika ingin menggunakan Cloudflare CDN)
   - **TTL:** `Auto`
6. Klik **Save**

#### Contoh di Namecheap:
1. Login ke Namecheap
2. Pilih domain → **Advanced DNS**
3. Di bagian **Host Records**, klik **Add New Record**
4. Isi:
   - **Type:** `A Record`
   - **Host:** `warehouse`
   - **Value:** `YOUR_SERVER_IP`
   - **TTL:** `Automatic`
5. Klik **Save**

#### Contoh di GoDaddy:
1. Login ke GoDaddy
2. Pilih domain → **DNS**
3. Klik **Add** di bagian **Records**
4. Isi:
   - **Type:** `A`
   - **Name:** `warehouse`
   - **Value:** `YOUR_SERVER_IP`
   - **TTL:** `600` (10 menit)
5. Klik **Save**

### Langkah 3: Verifikasi DNS

Tunggu beberapa menit (biasanya 5-15 menit) untuk DNS propagation, lalu verifikasi:

```bash
# Cek DNS record
dig warehouse.yourdomain.com
# atau
nslookup warehouse.yourdomain.com

# Test dari server
ping warehouse.yourdomain.com
```

**Catatan:** DNS propagation bisa memakan waktu hingga 48 jam, tapi biasanya hanya beberapa menit.

---

## 🔧 Konfigurasi Nginx untuk Subdomain

### Langkah 1: Buat Nginx Configuration File

```bash
sudo nano /etc/nginx/sites-available/warehouse-production
```

### Langkah 2: Isi Configuration

**Untuk HTTP (sementara):**
```nginx
server {
    listen 80;
    server_name warehouse.yourdomain.com;

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

**Ganti `warehouse.yourdomain.com` dengan subdomain Anda!**

### Langkah 3: Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/warehouse-production /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Jika test berhasil, reload Nginx
sudo systemctl reload nginx
```

### Langkah 4: Verifikasi

```bash
# Test dari browser atau curl
curl http://warehouse.yourdomain.com

# Atau buka di browser
# http://warehouse.yourdomain.com
```

---

## 🔒 Setup SSL untuk Subdomain

### Menggunakan Let's Encrypt (Certbot)

#### Langkah 1: Install Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

#### Langkah 2: Generate SSL Certificate

```bash
# Generate SSL untuk subdomain
sudo certbot --nginx -d warehouse.yourdomain.com

# Atau jika ingin include www juga
sudo certbot --nginx -d warehouse.yourdomain.com -d www.warehouse.yourdomain.com
```

Certbot akan:
- ✅ Otomatis generate SSL certificate
- ✅ Update Nginx configuration untuk HTTPS
- ✅ Setup auto-renewal

#### Langkah 3: Verifikasi SSL

```bash
# Test SSL
curl https://warehouse.yourdomain.com

# Atau buka di browser
# https://warehouse.yourdomain.com
```

#### Langkah 4: Test Auto-Renewal

```bash
# Test renewal (dry-run)
sudo certbot renew --dry-run
```

### Konfigurasi Nginx Setelah SSL

Setelah SSL di-generate, Certbot akan otomatis update file Nginx. File akan terlihat seperti ini:

```nginx
server {
    listen 80;
    server_name warehouse.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name warehouse.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/warehouse.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/warehouse.yourdomain.com/privkey.pem;

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

    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}
```

---

## 🏗️ Multiple Subdomain di Server yang Sama

Jika Anda ingin menjalankan **multiple aplikasi** di server yang sama dengan subdomain berbeda:

### Contoh: 2 Aplikasi di Server yang Sama

**Aplikasi 1:** `warehouse.yourdomain.com` → Port 3000  
**Aplikasi 2:** `production.yourdomain.com` → Port 3001

#### Langkah 1: Setup Aplikasi 2

```bash
# Edit .env aplikasi 2
cd /var/www/ProductionApp
nano .env
# Set PORT=3001
```

```bash
# Start aplikasi 2 dengan PM2
pm2 start server.js --name production-app --env production -- --port 3001
pm2 save
```

#### Langkah 2: Buat Nginx Config untuk Aplikasi 2

```bash
sudo nano /etc/nginx/sites-available/production-app
```

```nginx
server {
    listen 80;
    server_name production.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
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

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/production-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Langkah 3: Setup SSL untuk Aplikasi 2

```bash
sudo certbot --nginx -d production.yourdomain.com
```

---

## 🔍 Troubleshooting

### Masalah: Subdomain tidak bisa diakses

**Cek DNS:**
```bash
# Cek apakah DNS sudah resolve
dig warehouse.yourdomain.com
nslookup warehouse.yourdomain.com

# Pastikan IP address benar
```

**Cek Nginx:**
```bash
# Test configuration
sudo nginx -t

# Cek error logs
sudo tail -f /var/log/nginx/error.log

# Cek apakah site enabled
ls -la /etc/nginx/sites-enabled/
```

**Cek Aplikasi:**
```bash
# Cek apakah aplikasi running
pm2 status

# Cek logs aplikasi
pm2 logs warehouse-ui

# Test localhost
curl http://localhost:3000
```

### Masalah: SSL certificate tidak bisa di-generate

**Error: "Failed to obtain certificate"**

**Solusi:**
1. Pastikan DNS sudah resolve ke server IP
2. Pastikan port 80 dan 443 terbuka di firewall
3. Pastikan tidak ada aplikasi lain yang menggunakan port 80/443
4. Cek apakah domain sudah digunakan untuk certificate lain

```bash
# Cek port 80 dan 443
sudo netstat -tlnp | grep -E ':(80|443)'

# Cek firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Masalah: Redirect loop

**Solusi:**
Pastikan di Nginx config, `proxy_set_header Host $host;` sudah ada dan benar.

### Masalah: Mixed content (HTTP/HTTPS)

**Solusi:**
Pastikan aplikasi menggunakan HTTPS di semua request. Update konfigurasi aplikasi jika perlu.

---

## 📝 Checklist Setup Subdomain

- [ ] DNS A Record sudah dibuat
- [ ] DNS sudah resolve (cek dengan `dig` atau `nslookup`)
- [ ] Nginx configuration file sudah dibuat
- [ ] Nginx site sudah di-enable
- [ ] Nginx configuration sudah di-test (`nginx -t`)
- [ ] Nginx sudah di-reload
- [ ] Aplikasi bisa diakses via HTTP
- [ ] SSL certificate sudah di-generate
- [ ] SSL auto-renewal sudah di-test
- [ ] Aplikasi bisa diakses via HTTPS
- [ ] Firewall sudah dikonfigurasi (port 80, 443)

---

## 🎯 Contoh Lengkap

### Scenario: Setup `warehouse.yourdomain.com`

```bash
# 1. Setup DNS (di provider DNS Anda)
# A Record: warehouse → YOUR_SERVER_IP

# 2. Tunggu DNS propagation (5-15 menit)
dig warehouse.yourdomain.com

# 3. Buat Nginx config
sudo nano /etc/nginx/sites-available/warehouse-production
# Paste config (lihat di atas)

# 4. Enable site
sudo ln -s /etc/nginx/sites-available/warehouse-production /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 5. Test HTTP
curl http://warehouse.yourdomain.com

# 6. Setup SSL
sudo certbot --nginx -d warehouse.yourdomain.com

# 7. Test HTTPS
curl https://warehouse.yourdomain.com

# 8. Test auto-renewal
sudo certbot renew --dry-run
```

---

## 🔐 Security Best Practices untuk Subdomain

1. **Gunakan HTTPS selalu** - Redirect HTTP ke HTTPS
2. **Setup Security Headers** - Tambahkan di Nginx config:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

3. **Rate Limiting** - Batasi request per IP jika perlu
4. **Firewall** - Pastikan hanya port yang diperlukan yang terbuka

---

**Last Updated:** Desember 2024

