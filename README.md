# Manufacturing Process System - Warehouse Production UI

Sistem terintegrasi dengan Odoo API dan Authenticity API untuk manajemen proses produksi warehouse dengan SQLite database.

## 🎯 Fitur Utama

### 1. Sinkronisasi Data Odoo
- ✅ Auto-sync Manufacturing Orders (MO) setiap 5 menit
- ✅ Filter: 7 hari terakhir, status != done, group_worker 6 & 7
- ✅ Filter notes: "TEAM LIQUID - SHIFT 1/2/3"
- ✅ Enrichment: transfer_id dari stock.picking
- ✅ **Data UI dilindungi** - tidak akan ditimpa oleh sync

### 2. Manajemen MO (Manufacturing Order)
- ✅ Daftarkan MO siap produksi (input: auth_first, roll_number)
- ✅ Opsi: "Dijalankan di tengah produksi" (skip auth & roll)
- ✅ Start Production (input: leader_id)
- ✅ Changeover antar MO (input: new_auth, roll_number)
- ✅ End Production (input: authenticity, roll_number)

### 3. Database SQLite
6 tabel utama:
1. **recent_mo** - MO aktif dengan status dan enrichment
2. **master_authenticity_vendor** - Master data authenticity vendor
3. **authenticity_used_rm** - Penggunaan authenticity di warehouse RM
4. **authenticity_used_line** - Penggunaan authenticity di line produksi
5. **manufacturing_identity** - Identitas manufacturing per MO
6. **production_log** - Log aktivitas produksi (start/end/changeover)

### 4. Web UI
- ✅ Dashboard MO siap produksi
- ✅ Modal untuk semua operasi (daftar, start, changeover, end)
- ✅ Real-time updates
- ✅ Modern dark theme UI

### 5. Authentication & Role-Based Access Control
- ✅ Login system dengan role (Production / Warehouse)
- ✅ Production: Dapat start/changeover/end production, tidak dapat register MO
- ✅ Warehouse: Dapat register MO, tidak dapat start/changeover/end production
- ✅ Keduanya dapat start/stop scheduler

### 6. Data Export API
- ✅ RESTful API untuk mengambil data dari sistem yang sudah di-deploy
- ✅ Endpoints untuk: recent_mo, manufacturing_identity, production_log, dll
- ✅ Support pagination dan filtering
- ✅ Protected dengan authentication
- ✅ Contoh implementasi: Python, Node.js, curl

## 📦 Instalasi

### Prerequisites
- Node.js v14+ 
- npm atau yarn

### Setup
```bash
# 1. Install dependencies
npm install

# 2. Setup environment (opsional)
cp .env.example .env
# Edit .env dengan konfigurasi Anda

# 3. Initialize database
node scripts/setup_db.js

# 4. Migrate (jika database sudah ada)
node scripts/migrate_add_ready_flag.js
node scripts/migrate_add_production_log.js
```

### Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "sqlite3": "^5.1.0",
    "dotenv": "^16.0.0"
  }
}
```

## 🚀 Menjalankan Aplikasi

### 1. Sync Data Odoo (Manual)
```bash
node scripts/sync_recent_mo.js <ODOO_SESSION_ID>
```

### 2. Auto-Sync Scheduler (Recommended)
```bash
# Default: sync setiap 5 menit
node scripts/scheduler_sync.js <ODOO_SESSION_ID>

# Custom interval (10 menit)
SYNC_INTERVAL_MINUTES=10 node scripts/scheduler_sync.js <ODOO_SESSION_ID>
```

### 3. Web Server
```bash
node server.js
# Akses: http://localhost:3000
```

### 4. Production (dengan PM2)
```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start scripts/scheduler_sync.js --name odoo-sync -- <SESSION_ID>
pm2 start server.js --name warehouse-ui

# Monitor
pm2 logs
pm2 monit

# Auto-restart on reboot
pm2 startup
pm2 save
```

## 🔧 Konfigurasi

### Environment Variables (.env)
```bash
# Odoo Configuration
ODOO_API_URL=https://foomx.odoo.com
ODOO_SESSION_ID=your_session_id_here

# Authenticity API Configuration
AUTH_BASE_URL=https://api.authenticity.example.com
AUTH_API_KEY=your_api_key_here

# Database
SQLITE_PATH=warehouse_integrations.db

# Sync Scheduler
SYNC_INTERVAL_MINUTES=5

# Server
PORT=3000
```

### Mendapatkan Odoo Session ID
1. Login ke Odoo web
2. Buka Developer Tools (F12) → Application/Storage → Cookies
3. Copy value dari cookie `session_id`
4. Session biasanya valid 24-48 jam

## 📊 Struktur Database

### Table: recent_mo
```sql
CREATE TABLE recent_mo (
    mo_id INTEGER,
    mo_name TEXT PRIMARY KEY,
    state TEXT,
    group_worker_id INTEGER,
    note TEXT,
    product_id INTEGER,
    product_name TEXT,
    product_uom TEXT,
    product_qty REAL,
    initial_qty_target REAL,
    create_date TEXT,
    date_start TEXT,           -- UI input (Start Production)
    date_finished TEXT,         -- UI input (End Production/Changeover)
    origin TEXT,
    transfer_id INTEGER,
    auth_first TEXT,            -- UI input (Daftarkan MO)
    auth_last TEXT,             -- UI input (End Production/Changeover)
    leader_id TEXT,             -- UI input (Start Production)
    roll_number TEXT,           -- UI input (Daftarkan MO/Changeover/End)
    ready_for_production INTEGER DEFAULT 0  -- UI flag
);
```

### Table: production_log
```sql
CREATE TABLE production_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mo_name TEXT NOT NULL,
    product_name TEXT,
    leader_id TEXT,
    status TEXT CHECK(status IN ('start', 'end', 'changeover')),
    create_at TEXT DEFAULT (datetime('now'))
);
```

Lihat `schema.sql` untuk tabel lengkap.

## 🔒 Keamanan Data

### Strategi Perlindungan
**Field dari Odoo** (di-update otomatis):
- mo_name, state, product_*, create_date, origin, transfer_id

**Field dari UI** (DILINDUNGI):
- auth_first, auth_last, leader_id, roll_number
- date_start, date_finished, ready_for_production

### Mekanisme
- INSERT: `ON CONFLICT DO NOTHING` (tidak overwrite jika sudah ada)
- UPDATE: Hanya update field Odoo, **skip field UI**
- COALESCE: Pertahankan nilai lama jika data baru NULL

Lihat `DATA_SYNC_STRATEGY.md` untuk detail lengkap.

## 📡 API Endpoints

### Manufacturing Orders
```
GET  /api/mo-options          # List MO belum ready
GET  /api/ready-mo            # List MO siap produksi
GET  /api/ready-mo-details    # Detail MO untuk prefill
GET  /api/running-mo          # List MO sedang berjalan
```

### Operations
```
POST /api/register-mo         # Daftarkan MO siap produksi
POST /api/start-production    # Mulai produksi
POST /api/changeover          # Changeover antar MO
POST /api/end-production      # Akhiri produksi
```

### Request/Response Examples

#### POST /api/register-mo
```json
// Normal registration
{
  "mo_name": "MO/00123",
  "auth_first": "A12345",
  "roll_number": "R001"
}

// Mid-production (skip auth & roll)
{
  "mo_name": "MO/00124",
  "run_mid_production": true
}
```

#### POST /api/start-production
```json
{
  "mo_name": "MO/00123",
  "leader_id": "L001"
}
```

#### POST /api/changeover
```json
{
  "current_mo": "MO/00123",
  "next_mo": "MO/00124",
  "new_auth": "12500",
  "roll_number": "R002"  // optional
}
```

#### POST /api/end-production
```json
{
  "mo_name": "MO/00123",
  "authenticity": "12600",
  "roll_number": "R001"  // optional
}
```

## 🎨 UI Workflow

### 1. Daftarkan MO Siap Produksi
- Pilih MO dari list (recent_mo yang belum ready)
- Input: First Authenticity Code, Roll Number
- Atau: Centang "Dijalankan di tengah produksi" (skip input)
- Result: MO masuk ke tabel "MO Siap Produksi"

### 2. Start Production
- Pilih MO dari "MO Siap Produksi"
- Prefill: SKU, Target Qty, UoM, First Auth, Roll
- Input: Leader ID saja
- Result: date_start terisi, log status 'start'

### 3. Changeover
- Pilih MO Berjalan (yang sudah start)
- Pilih MO Berikutnya (dari siap produksi)
- Input: Nomor Authenticity Baru, Roll Number (optional)
- Result:
  - MO current: auth_last = new_auth - 1, date_finished terisi
  - MO next: auth_first = new_auth, date_start terisi
  - Log status 'changeover'

### 4. End Production
- Pilih MO Berjalan
- Input: Nomor Authenticity, Roll Number (optional)
- Result: auth_last = auth - 1, date_finished terisi, log status 'end'

## 🔍 Monitoring & Troubleshooting

### Logs
```bash
# Scheduler logs
tail -f logs/scheduler.log  # jika di-setup

# PM2 logs
pm2 logs odoo-sync
pm2 logs warehouse-ui

# Server logs
# Lihat console output dari node server.js
```

### Common Issues

#### Session Expired
```
❌ Error: 401 Unauthorized
```
**Solusi:** Refresh Odoo session ID dan restart scheduler

#### Sync Gagal
```
❌ Sync failed: ECONNREFUSED
```
**Solusi:** Cek koneksi internet dan Odoo API URL

#### Database Locked
```
❌ Error: SQLITE_BUSY: database is locked
```
**Solusi:** Pastikan tidak ada multiple process yang menulis bersamaan

#### Field UI Hilang
**Tidak mungkin** dengan strategi sync saat ini. Jika terjadi:
1. Cek apakah ada script lain yang mengubah database
2. Cek log sync untuk error
3. Restore dari backup

## 📁 Struktur Project

```
UI_Warehouse_Production/
├── config.js                    # Konfigurasi central
├── db.js                        # SQLite connection helper
├── schema.sql                   # Database schema
├── server.js                    # Express API server
├── services_odoo.js             # Odoo API client
├── services_authenticity.js     # Authenticity API client (stub)
├── public/
│   └── index.html              # Web UI (Manufacturing_Process_System)
├── scripts/
│   ├── setup_db.js             # Initialize database
│   ├── sync_recent_mo.js       # Manual sync script
│   ├── scheduler_sync.js       # Auto-sync scheduler
│   ├── migrate_add_ready_flag.js
│   └── migrate_add_production_log.js
├── query_*.js                   # Odoo query utilities
├── DATA_SYNC_STRATEGY.md        # Dokumentasi strategi sync
├── README.md                    # This file
├── .env                         # Environment config (gitignored)
└── warehouse_integrations.db    # SQLite database (gitignored)
```

## 🧪 Testing

### Manual Testing
```bash
# 1. Setup fresh database
rm warehouse_integrations.db
node scripts/setup_db.js

# 2. Sync data
node scripts/sync_recent_mo.js <SESSION_ID>

# 3. Start server
node server.js

# 4. Test UI
# Buka http://localhost:3000
# Test semua workflow: register, start, changeover, end

# 5. Verify data protection
# Jalankan sync lagi, pastikan data UI tidak berubah
node scripts/sync_recent_mo.js <SESSION_ID>
```

### Automated Testing (Future)
```bash
# TODO: Implement unit tests
npm test
```

## 🚧 Roadmap

### Completed ✅
- [x] Odoo API integration
- [x] SQLite database schema
- [x] Auto-sync scheduler dengan data protection
- [x] Web UI untuk semua operasi
- [x] Production log tracking
- [x] Changeover workflow
- [x] Mid-production registration

### In Progress 🔄
- [ ] Authenticity API integration (endpoints stubbed)
- [ ] Master authenticity vendor sync
- [ ] RM usage tracking
- [ ] Line usage tracking

### Planned 📋
- [ ] Dashboard analytics
- [ ] Export reports (Excel/PDF)
- [x] User authentication
- [x] Data Export API
- [ ] Multi-shift management
- [ ] Real-time notifications
- [ ] Mobile responsive UI

## 🤝 Contributing

### Development Setup
```bash
# Clone repo
git clone <repo-url>
cd UI_Warehouse_Production

# Install deps
npm install

# Setup database
node scripts/setup_db.js

# Start development
npm run dev  # jika ada script dev
```

### Code Style
- Use ES6+ features
- 2 spaces indentation
- Semicolons required
- Comments in Indonesian for business logic

## 📄 License

[Your License Here]

## 👥 Team

[Your Team Info]

## 🌐 Mengambil Data dari Sistem yang Sudah Deploy

Jika Anda sudah mendeploy sistem ini di web dan ingin mengambil data dari device/application lain, gunakan **Data Export API**.

### Authentication: API Key (Recommended)

**Cara terbaik untuk external access adalah menggunakan API Key:**

1. **Generate API Key melalui halaman admin:**
   - Akses: `https://your-server.com/admin`
   - Login dengan user production/warehouse
   - Klik "Generate API Key"
   - **Simpan API key** (tidak akan ditampilkan lagi!)

2. **Gunakan API key untuk mengambil data:**
```bash
curl -H "x-api-key: mps_your_api_key_here" \
  https://your-server.com/api/data/recent-mo?limit=50
```

### Authentication: Session Token (Alternatif)

1. **Login untuk mendapatkan token:**
```bash
curl -X POST https://your-server.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"production","password":"password123"}'
```

2. **Gunakan token untuk mengambil data:**
```bash
curl -H "x-session-token: YOUR_TOKEN" \
  https://your-server.com/api/data/recent-mo?limit=50
```

### Contoh Implementasi

Lihat folder `examples/` untuk contoh implementasi:
- `examples/fetch_data_python.py` - Contoh Python
- `examples/fetch_data_nodejs.js` - Contoh Node.js
- `examples/fetch_data_curl.sh` - Contoh bash/curl

### API Endpoints Tersedia

- `GET /api/data/recent-mo` - Data recent MO
- `GET /api/data/manufacturing-identity` - Data manufacturing identity
- `GET /api/data/production-log` - Data production log
- `GET /api/data/master-authenticity-vendor` - Data master authenticity vendor
- `GET /api/data/authenticity-used-rm` - Data authenticity used RM
- `GET /api/data/authenticity-used-line` - Data authenticity used line

**Lihat `API_DOCUMENTATION.md` untuk dokumentasi lengkap!**

## 💻 Local Development & Database Access

### Menjalankan di Local

Sistem ini **bisa dijalankan di local** tanpa masalah:

```bash
npm install
node scripts/setup_db.js
node scripts/migrate_add_auth.js
node scripts/migrate_add_api_keys.js
npm start
```

Server akan berjalan di `http://localhost:3000`

### Mengakses Database dengan DBeaver

**Ya, bisa langsung dibuka di DBeaver tanpa konfigurasi tambahan!**

1. Buka DBeaver → Create New Connection → **SQLite**
2. Path: `warehouse_integrations.db` (di root project)
3. Test Connection → Finish ✅

**Lihat `LOCAL_DEPLOYMENT.md` untuk panduan lengkap!**

## 🚀 Deployment ke Website

Untuk mendeploy aplikasi ini ke server web (VPS, Cloud Platform, dll):

### Quick Start
- **Panduan Cepat:** Lihat [`DEPLOYMENT_QUICKSTART.md`](DEPLOYMENT_QUICKSTART.md) untuk deployment dalam 10 menit
- **Panduan Lengkap:** Lihat [`DEPLOYMENT.md`](DEPLOYMENT.md) untuk panduan detail
- **Setup Subdomain:** Lihat [`SUBDOMAIN_SETUP.md`](SUBDOMAIN_SETUP.md) jika ingin menggunakan subdomain

### Opsi Deployment
1. **VPS/Server** (DigitalOcean, AWS EC2, dll) - Recommended untuk production
2. **Cloud Platform** (Railway, Render, Heroku) - Mudah dan cepat
3. **Docker** - Portable dan mudah di-deploy

### Checklist Cepat
- [ ] Server sudah setup (Node.js, PM2, Nginx)
- [ ] Aplikasi sudah di-deploy
- [ ] Database sudah di-setup
- [ ] Environment variables sudah dikonfigurasi
- [ ] Reverse proxy (Nginx) sudah dikonfigurasi
- [ ] SSL certificate sudah di-setup (untuk HTTPS)
- [ ] Firewall sudah dikonfigurasi

**Lihat `DEPLOYMENT.md` untuk panduan lengkap deployment!**

## 📞 Support

Untuk pertanyaan atau issue:
- Email: [your-email]
- Issue Tracker: [github-issues-url]

---

**Last Updated:** November 2025
**Version:** 1.0.0







