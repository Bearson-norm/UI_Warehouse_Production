# Strategi Sinkronisasi Data - Perlindungan Input UI

## 🎯 Tujuan
Memastikan data yang diinput dari UI **TIDAK PERNAH** ditimpa oleh auto-sync dari Odoo API.

## 📊 Pemisahan Data

### Data dari Odoo (Boleh di-update oleh sync)
Field-field ini akan selalu diperbarui dari Odoo setiap sync:
- `mo_id` - ID internal Odoo
- `mo_name` - Nomor MO (unique key)
- `state` - Status MO (draft, confirmed, progress, done, cancel)
- `group_worker_id` - ID grup worker
- `note` - Catatan dari Odoo
- `product_id` - ID produk
- `product_name` - Nama produk
- `product_uom` - Unit of Measure
- `product_qty` - Quantity
- `initial_qty_target` - Target quantity awal
- `create_date` - Tanggal dibuat di Odoo
- `origin` - Origin/reference
- `transfer_id` - ID transfer (dari stock.picking)

### Data dari UI (DILINDUNGI - tidak akan ditimpa)
Field-field ini **hanya** diisi/diubah dari UI dan **tidak pernah** di-update oleh sync:
- `auth_first` - Authenticity code awal (dari modal "Daftarkan MO")
- `auth_last` - Authenticity code akhir (dari modal "End Production" / "Changeover")
- `leader_id` - ID leader (dari modal "Start Production")
- `roll_number` - Nomor roll (dari modal "Daftarkan MO" / "Changeover" / "End Production")
- `ready_for_production` - Flag siap produksi (dari modal "Daftarkan MO")
- `date_start` - Tanggal mulai produksi (dari modal "Start Production" / "Changeover")
- `date_finished` - Tanggal selesai produksi (dari modal "End Production" / "Changeover")

## 🔒 Mekanisme Perlindungan

### 1. INSERT (MO Baru)
Ketika MO baru dari Odoo:
```sql
INSERT INTO recent_mo (...) VALUES (...)
ON CONFLICT (mo_name) DO NOTHING;
```
- Jika MO sudah ada (conflict), **tidak melakukan apa-apa**
- Field UI tetap aman karena tidak di-insert ulang

### 2. UPDATE (MO yang Sudah Ada)
Ketika sync update MO yang sudah ada:
```sql
UPDATE recent_mo
SET state = ?,
    group_worker_id = ?,
    note = ?,
    product_id = ?,
    product_name = ?,
    product_uom = ?,
    product_qty = ?,
    initial_qty_target = ?,
    create_date = ?,
    origin = ?,
    transfer_id = COALESCE(?, transfer_id)
WHERE mo_name = ?;
```

**Perhatikan:**
- ❌ `date_start` **TIDAK** ada di UPDATE
- ❌ `date_finished` **TIDAK** ada di UPDATE
- ❌ `auth_first` **TIDAK** ada di UPDATE
- ❌ `auth_last` **TIDAK** ada di UPDATE
- ❌ `leader_id` **TIDAK** ada di UPDATE
- ❌ `roll_number` **TIDAK** ada di UPDATE
- ❌ `ready_for_production` **TIDAK** ada di UPDATE

### 3. COALESCE untuk transfer_id
```sql
transfer_id = COALESCE(?, transfer_id)
```
- Jika sync menemukan `transfer_id` baru, gunakan yang baru
- Jika sync tidak menemukan (NULL), **pertahankan nilai lama**

## 📅 Schedule Auto-Sync

### Menjalankan Scheduler
```bash
# Default: sync setiap 5 menit
node scripts/scheduler_sync.js <session_id>

# Custom interval (contoh: 10 menit)
SYNC_INTERVAL_MINUTES=10 node scripts/scheduler_sync.js <session_id>
```

### Fitur Scheduler
- ✅ Auto-sync setiap N menit (default: 5)
- ✅ Mencegah overlap (skip jika sync sebelumnya masih berjalan)
- ✅ Logging lengkap dengan timestamp
- ✅ Graceful shutdown (Ctrl+C)
- ✅ Statistik sync (total count, last sync time)

## 🔄 Alur Data Lengkap

```
┌─────────────────────────────────────────────────────────────┐
│                      ODOO API                                │
│  (MO data: state, product, qty, dates from Odoo)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Auto-sync setiap 5 menit
                     │ (hanya update field Odoo)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   SQLite Database                            │
│                   Table: recent_mo                           │
│                                                              │
│  ┌──────────────────────┐  ┌───────────────────────────┐   │
│  │   Field dari Odoo    │  │    Field dari UI          │   │
│  │   (auto-update)      │  │    (PROTECTED)            │   │
│  ├──────────────────────┤  ├───────────────────────────┤   │
│  │ • mo_name            │  │ • auth_first              │   │
│  │ • state              │  │ • auth_last               │   │
│  │ • product_name       │  │ • leader_id               │   │
│  │ • product_qty        │  │ • roll_number             │   │
│  │ • create_date        │  │ • date_start              │   │
│  │ • transfer_id        │  │ • date_finished           │   │
│  │ • ...                │  │ • ready_for_production    │   │
│  └──────────────────────┘  └───────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Read/Write via API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express Server (API)                       │
│  • GET /api/mo-options                                       │
│  • GET /api/ready-mo                                         │
│  • POST /api/register-mo                                     │
│  • POST /api/start-production                                │
│  • POST /api/changeover                                      │
│  • POST /api/end-production                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP requests
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Web UI (Manufacturing_Process_System)           │
│  • Daftarkan MO (input: auth_first, roll_number)            │
│  • Start Production (input: leader_id)                       │
│  • Changeover (input: new_auth, roll_number)                │
│  • End Production (input: authenticity, roll_number)         │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Jaminan Keamanan Data

### Skenario 1: MO Baru dari Odoo
1. Sync menemukan MO baru → INSERT ke database
2. User mendaftarkan MO via UI → UPDATE `auth_first`, `roll_number`, `ready_for_production`
3. Sync berikutnya → UPDATE hanya field Odoo, field UI **tetap aman**

### Skenario 2: User Start Production
1. User klik "Start Production" → UPDATE `date_start`, `leader_id`
2. Sync berjalan → UPDATE hanya field Odoo
3. `date_start` dan `leader_id` **tidak berubah** ✅

### Skenario 3: User Changeover
1. User klik "Changeover" → UPDATE:
   - MO current: `auth_last`, `date_finished`
   - MO next: `auth_first`, `date_start`, `roll_number`
2. Sync berjalan → UPDATE hanya field Odoo
3. Semua field UI **tetap aman** ✅

### Skenario 4: User End Production
1. User klik "End Production" → UPDATE `auth_last`, `date_finished`, `roll_number`
2. Sync berjalan → UPDATE hanya field Odoo
3. Field UI **tidak ditimpa** ✅

## 🚨 Catatan Penting

### Kapan Data Bisa Berubah?
**Field Odoo** (state, product_qty, dll):
- ✅ Akan selalu sync dengan Odoo terbaru
- ✅ Jika ada perubahan di Odoo, akan ter-update di database lokal
- ✅ Ini **diinginkan** karena kita ingin data Odoo selalu fresh

**Field UI** (auth_first, date_start, dll):
- ❌ **TIDAK PERNAH** diubah oleh sync Odoo
- ✅ Hanya bisa diubah melalui UI/API endpoints
- ✅ Sekali diisi, akan tetap ada sampai diubah manual via UI

### Rekomendasi
1. **Jalankan scheduler** sebagai background service untuk auto-sync
2. **Monitor log** scheduler untuk memastikan sync berjalan lancar
3. **Backup database** secara berkala (file `warehouse_integrations.db`)
4. **Session ID** Odoo perlu di-refresh jika expired (biasanya 24-48 jam)

## 📝 Contoh Penggunaan

### Setup Awal
```bash
# 1. Install dependencies
npm install

# 2. Setup database
node scripts/setup_db.js

# 3. Sync manual pertama kali
node scripts/sync_recent_mo.js <session_id>

# 4. Start scheduler (auto-sync setiap 5 menit)
node scripts/scheduler_sync.js <session_id>

# 5. Start web server (di terminal terpisah)
node server.js
```

### Production Deployment
```bash
# Gunakan PM2 atau systemd untuk keep-alive

# Dengan PM2:
pm2 start scripts/scheduler_sync.js --name odoo-sync -- <session_id>
pm2 start server.js --name warehouse-ui

# Dengan systemd (buat service file):
# /etc/systemd/system/odoo-sync.service
# /etc/systemd/system/warehouse-ui.service
```

## 🔍 Troubleshooting

### Sync Gagal
- Cek session ID masih valid
- Cek koneksi ke Odoo API
- Lihat log error di console

### Data UI Hilang
- **Tidak mungkin** jika menggunakan script ini
- Jika terjadi, kemungkinan:
  - Database di-reset manual
  - Ada script lain yang mengubah data
  - Bug di API endpoint (bukan di sync script)

### Performa Lambat
- Kurangi interval sync (misal: 10 menit)
- Tambahkan index di database jika perlu
- Batasi jumlah MO yang di-sync (ubah filter di `sync_recent_mo.js`)

---

**Kesimpulan:** Dengan strategi ini, data dari UI **100% aman** dari overwrite oleh auto-sync Odoo. Anda bisa menjalankan scheduler setiap 5 menit tanpa khawatir data input user hilang.









