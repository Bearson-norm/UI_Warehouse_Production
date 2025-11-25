# Quick Reference: Setup Subdomain

Panduan cepat setup subdomain untuk aplikasi Manufacturing Process System.

## 🚀 Quick Setup (5 Menit)

### 1. Setup DNS (di Provider DNS Anda)

**Tambahkan A Record:**
- **Type:** `A`
- **Name:** `warehouse` (atau subdomain pilihan Anda)
- **Value:** `YOUR_SERVER_IP`
- **TTL:** `Auto` atau `600`

**Contoh:** `warehouse.yourdomain.com` → `123.45.67.89`

### 2. Tunggu DNS Propagation (5-15 menit)

```bash
# Cek DNS
dig warehouse.yourdomain.com
# atau
nslookup warehouse.yourdomain.com
```

### 3. Buat Nginx Config

```bash
sudo nano /etc/nginx/sites-available/warehouse-production
```

**Paste ini (ganti `warehouse.yourdomain.com` dengan subdomain Anda):**

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

    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}
```

### 4. Enable & Test

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/warehouse-production /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx

# Test
curl http://warehouse.yourdomain.com
```

### 5. Setup SSL

```bash
# Install certbot (jika belum)
sudo apt install -y certbot python3-certbot-nginx

# Generate SSL
sudo certbot --nginx -d warehouse.yourdomain.com

# Test
curl https://warehouse.yourdomain.com
```

## ✅ Done!

Aplikasi sekarang bisa diakses di `https://warehouse.yourdomain.com`

---

## 🔧 Troubleshooting Cepat

**Subdomain tidak bisa diakses?**
```bash
# Cek DNS
dig warehouse.yourdomain.com

# Cek Nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log

# Cek aplikasi
pm2 status
curl http://localhost:3000
```

**SSL error?**
```bash
# Pastikan DNS sudah resolve
dig warehouse.yourdomain.com

# Pastikan port 80 & 443 terbuka
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

**Lihat [`SUBDOMAIN_SETUP.md`](SUBDOMAIN_SETUP.md) untuk panduan lengkap!**

