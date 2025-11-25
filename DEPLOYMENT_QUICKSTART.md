# Quick Start Deployment Guide

Panduan cepat untuk mendeploy aplikasi ke server dalam 10 menit.

## 🚀 Quick Deploy ke VPS (Ubuntu/Debian)

### Step 1: Setup Server (5 menit)
```bash
# SSH ke server
ssh user@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

### Step 2: Deploy Aplikasi (3 menit)
```bash
# Clone atau upload project
cd /var/www
git clone https://github.com/your-repo/UI_Warehouse_Production.git
cd UI_Warehouse_Production

# Install dependencies
npm install --production

# Setup database
node scripts/setup_db.js
node scripts/migrate_add_auth.js
node scripts/migrate_add_api_keys.js
```

### Step 3: Konfigurasi (2 menit)
```bash
# Buat file .env
nano .env
```

Paste ini (ganti dengan nilai Anda):
```env
NODE_ENV=production
PORT=3000
ODOO_API_URL=https://foomx.odoo.com
ODOO_SESSION_ID=your_session_id_here
SQLITE_PATH=/var/www/UI_Warehouse_Production/warehouse_integrations.db
```

### Step 4: Start Aplikasi
```bash
# Start dengan PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Jalankan command yang ditampilkan

# Setup Nginx reverse proxy
sudo nano /etc/nginx/sites-available/default
```

Ganti isi `location /` dengan:
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

```bash
# Reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# Setup firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### ✅ Selesai!

Aplikasi sekarang bisa diakses di `http://your-server-ip`

---

## 🌐 Setup Domain & SSL (Opsional)

> **💡 Tips:** Untuk menggunakan **subdomain** (misalnya `warehouse.yourdomain.com`), lihat panduan lengkap di [`SUBDOMAIN_SETUP.md`](SUBDOMAIN_SETUP.md)

### 1. Point Domain ke Server IP
- Di DNS provider, tambahkan A record:
  - `your-domain.com` → `your-server-ip`
  - `www.your-domain.com` → `your-server-ip`
  
**Atau untuk subdomain:**
  - `warehouse.yourdomain.com` → `your-server-ip`

### 2. Install SSL (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 3. Update Nginx Config
```bash
sudo nano /etc/nginx/sites-available/default
```

Tambahkan server block untuk HTTPS (Certbot biasanya sudah otomatis).

---

## ☁️ Quick Deploy ke Railway (5 menit)

1. **Sign up** di https://railway.app (dengan GitHub)
2. **New Project** → **Deploy from GitHub repo**
3. **Add Environment Variables:**
   - `NODE_ENV=production`
   - `ODOO_API_URL=https://foomx.odoo.com`
   - `ODOO_SESSION_ID=your_session_id`
   - `SQLITE_PATH=./warehouse_integrations.db`
4. **Deploy** → Railway akan otomatis build & deploy
5. **Setup Database:**
   - Buka Railway dashboard → **View Logs**
   - Klik **Open Shell**
   - Run: `node scripts/setup_db.js`

✅ Selesai! Aplikasi live di `https://your-app.railway.app`

---

## 📋 Checklist Cepat

- [ ] Node.js terinstall
- [ ] PM2 terinstall
- [ ] Aplikasi di-deploy
- [ ] Database di-setup
- [ ] `.env` dikonfigurasi
- [ ] PM2 running
- [ ] Nginx dikonfigurasi
- [ ] Firewall dibuka
- [ ] Aplikasi bisa diakses

---

## 🆘 Troubleshooting Cepat

**Aplikasi tidak bisa diakses?**
```bash
pm2 status          # Cek apakah running
pm2 logs            # Cek error
sudo nginx -t       # Cek Nginx config
```

**Database error?**
```bash
node scripts/setup_db.js  # Setup ulang
```

**Port sudah digunakan?**
```bash
# Ganti PORT di .env
PORT=3001
pm2 restart warehouse-ui
```

---

**Lihat `DEPLOYMENT.md` untuk panduan lengkap!**

