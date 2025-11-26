# 🚀 Quick Start Guide

Panduan cepat untuk menjalankan Manufacturing Process System dalam 5 menit.

## ⚡ Setup Cepat

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
node scripts/setup_db.js
```

### 3. Dapatkan Odoo Session ID
1. Login ke https://foomx.odoo.com
2. Tekan F12 → Application → Cookies
3. Copy value dari `session_id`

### 4. Sync Data Pertama Kali
```bash
node scripts/sync_recent_mo.js <PASTE_SESSION_ID_DISINI>
```

### 5. Start Server
```bash
node server.js
```

### 6. Buka Browser
```
http://localhost:3000
```

## 🎯 Workflow Pertama Kali

### A. Daftarkan MO Siap Produksi
1. Klik tombol **"Daftarkan MO (Siap Produksi)"**
2. Pilih MO dari dropdown
3. Isi:
   - First Authenticity Code: `10000` (contoh)
   - Roll Number: `R001` (contoh)
4. Klik **Simpan**
5. MO akan muncul di tabel "MO Siap Produksi"

### B. Start Production
1. Klik tombol **"Start Production"**
2. Pilih MO yang sudah didaftarkan
3. Field akan terisi otomatis (SKU, Target, Auth, Roll)
4. Isi **Leader ID**: `L001` (contoh)
5. Klik **Mulai**
6. Production dimulai! (date_start terisi)

### C. Changeover (Ganti MO)
1. Klik tombol **"Changeover"**
2. Pilih:
   - **MO Berjalan**: MO yang sedang aktif
   - **MO Berikutnya**: MO yang akan dijalankan
3. Isi:
   - **Nomor Authenticity Baru**: `10500` (contoh)
   - **Nomor Roll (Next)**: `R002` (opsional)
4. Klik **Simpan**
5. Hasil:
   - MO lama: selesai (auth_last = 10499, date_finished terisi)
   - MO baru: mulai (auth_first = 10500, date_start terisi)

### D. End Production
1. Klik tombol **"End Production"**
2. Pilih MO yang sedang berjalan
3. Isi:
   - **Nomor Authenticity**: `10800` (contoh)
   - **Nomor Roll**: `R001` (opsional)
4. Klik **Simpan**
5. Production selesai! (auth_last = 10799, date_finished terisi)

## 🔄 Auto-Sync (Recommended)

Untuk auto-refresh data dari Odoo setiap 5 menit:

```bash
# Terminal 1: Scheduler
node scripts/scheduler_sync.js <SESSION_ID>

# Terminal 2: Web Server
node server.js
```

**Atau dengan PM2:**
```bash
# Install PM2 (sekali saja)
npm install -g pm2

# Edit ecosystem.config.js, set ODOO_SESSION_ID
# Lalu start:
pm2 start ecosystem.config.js

# Monitor
pm2 logs
pm2 monit

# Stop
pm2 stop all
```

## 📊 Cek Data

### Via SQLite CLI
```bash
sqlite3 warehouse_integrations.db

# List MO
SELECT mo_name, state, ready_for_production FROM recent_mo;

# List production log
SELECT * FROM production_log ORDER BY create_at DESC LIMIT 10;

# Exit
.quit
```

### Via Node
```javascript
const { db } = require('./db');

db.all('SELECT * FROM recent_mo', (err, rows) => {
  console.log(rows);
});
```

## 🐛 Troubleshooting

### Port 3000 sudah dipakai
```bash
# Ganti port di .env atau:
PORT=3001 node server.js
```

### Session ID expired
```
❌ Error: 401 Unauthorized
```
**Solusi:** Dapatkan session ID baru dari Odoo dan restart scheduler

### Database locked
```
❌ SQLITE_BUSY: database is locked
```
**Solusi:** Stop semua process yang akses database, lalu restart

### Sync tidak jalan
```bash
# Cek manual
node scripts/sync_recent_mo.js <SESSION_ID>

# Lihat error message
```

## 📝 Tips

### 1. Backup Database
```bash
# Sebelum testing
cp warehouse_integrations.db warehouse_integrations.db.backup

# Restore jika perlu
cp warehouse_integrations.db.backup warehouse_integrations.db
```

### 2. Reset Database
```bash
rm warehouse_integrations.db
node scripts/setup_db.js
node scripts/sync_recent_mo.js <SESSION_ID>
```

### 3. Custom Sync Interval
```bash
# Sync setiap 10 menit
SYNC_INTERVAL_MINUTES=10 node scripts/scheduler_sync.js <SESSION_ID>
```

### 4. Development Mode (auto-reload)
```bash
npm install -g nodemon
nodemon server.js
```

## 🎓 Next Steps

1. ✅ Baca `README.md` untuk dokumentasi lengkap
2. ✅ Baca `DATA_SYNC_STRATEGY.md` untuk memahami data protection
3. ✅ Setup PM2 untuk production deployment
4. ✅ Integrate dengan Authenticity API (edit `services_authenticity.js`)
5. ✅ Customize UI sesuai kebutuhan (edit `public/index.html`)

## 🆘 Butuh Bantuan?

- Dokumentasi lengkap: `README.md`
- Strategi sync: `DATA_SYNC_STRATEGY.md`
- Database schema: `schema.sql`
- API endpoints: Lihat `server.js`

---

**Selamat mencoba! 🎉**









