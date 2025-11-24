# Analisis Relasi Tabel: authenticity_used_rm dengan authenticity_used_line dan manufacturing_identity

## Ringkasan

Berdasarkan pemeriksaan dokumentasi API dan struktur database, **YA, Anda bisa mendapatkan tabel `authenticity_used_rm` yang memiliki keterhubungan dengan `authenticity_used_line` dan `manufacturing_identity`**, namun **tidak secara langsung** dari query `query_mrp_production`, `query_stock_move`, dan `query_stock_picking`.

## Struktur Tabel

### 1. authenticity_used_rm
```sql
CREATE TABLE authenticity_used_rm (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id INTEGER,        -- Kunci relasi ke stock.picking
    authenticity TEXT,
    transfer_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 2. authenticity_used_line
```sql
CREATE TABLE authenticity_used_line (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mo_name TEXT,               -- Kunci relasi ke recent_mo dan manufacturing_identity
    sku_barcode TEXT,
    auth_first_code TEXT,
    auth_last_code TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 3. manufacturing_identity
```sql
CREATE TABLE manufacturing_identity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mo_name TEXT,               -- Kunci relasi ke recent_mo dan authenticity_used_line
    sku TEXT,
    sku_name TEXT,
    target_qty REAL,
    done_qty REAL,
    leader_name TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 4. recent_mo (Tabel Penghubung)
```sql
CREATE TABLE recent_mo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mo_id INTEGER,
    mo_name TEXT,               -- Kunci relasi ke authenticity_used_line dan manufacturing_identity
    transfer_id INTEGER,         -- Kunci relasi ke authenticity_used_rm
    ...
);
```

## Relasi Antar Tabel

### Relasi Langsung:
1. **authenticity_used_rm ↔ recent_mo**
   - `authenticity_used_rm.transfer_id` = `recent_mo.transfer_id`
   - Relasi ini menghubungkan authenticity yang digunakan di warehouse RM dengan Manufacturing Order

2. **authenticity_used_line ↔ recent_mo**
   - `authenticity_used_line.mo_name` = `recent_mo.mo_name`
   - Relasi ini menghubungkan authenticity yang digunakan di line produksi dengan Manufacturing Order

3. **manufacturing_identity ↔ recent_mo**
   - `manufacturing_identity.mo_name` = `recent_mo.mo_name`
   - Relasi ini menghubungkan identitas manufacturing dengan Manufacturing Order

### Relasi Tidak Langsung:
4. **authenticity_used_rm ↔ authenticity_used_line**
   - Melalui `recent_mo`:
     - `authenticity_used_rm.transfer_id` = `recent_mo.transfer_id`
     - `recent_mo.mo_name` = `authenticity_used_line.mo_name`

5. **authenticity_used_rm ↔ manufacturing_identity**
   - Melalui `recent_mo`:
     - `authenticity_used_rm.transfer_id` = `recent_mo.transfer_id`
     - `recent_mo.mo_name` = `manufacturing_identity.mo_name`

## Sumber Data dari Query Odoo

### ⚠️ PENTING: Script Query Standalone vs Script Sync

**Script standalone** (`query_mrp_production.js`, `query_stock_picking.js`, `query_stock_move.js`) adalah script untuk **testing/debugging** dan **TIDAK digunakan untuk sync data ke database**.

**Script yang sebenarnya mengisi database** adalah:
- `scripts/sync_recent_mo.js` - Menggunakan `services_odoo.js` untuk query Odoo

### 1. query_mrp_production.js (Standalone - Testing Only)
- **Model Odoo**: `mrp.production` (Manufacturing Order)
- **Tujuan**: Script standalone untuk testing/debugging
- **TIDAK digunakan untuk sync database**
- **Field yang diambil**: `id`, `name`, `product_id`, `product_qty`, `date_start`, `date_finished`, `state`, `origin`, dll

### 2. query_stock_picking.js (Standalone - Testing Only)
- **Model Odoo**: `stock.picking` (Stock Transfer/Picking)
- **Tujuan**: Script standalone untuk testing/debugging
- **TIDAK digunakan untuk sync database**
- **Field yang diambil**: `id`, `name`, `origin`, `scheduled_date`, `date_done`, `state`, dll

### 3. query_stock_move.js (Standalone - Testing Only)
- **Model Odoo**: `stock.move` (Stock Movement)
- **Tujuan**: Script standalone untuk testing/debugging
- **TIDAK digunakan untuk sync database**
- **Field yang diambil**: `id`, `name`, `reference`, `picking_id`, `product_id`, `quantity_done`, `state`, dll

### 4. scripts/sync_recent_mo.js (Script Sync Aktif)
- **Model Odoo yang digunakan**:
  - `mrp.production` - Untuk mengambil data Manufacturing Order
  - `stock.picking` - Untuk mencari `transfer_id` yang terkait dengan MO
- **Cara kerja**:
  1. Query `mrp.production` dengan filter (7 hari terakhir, state != done, group_worker 6/7, dll)
  2. Untuk setiap MO, panggil `findRelatedTransferIdByMo()` yang query `stock.picking` berdasarkan:
     - `origin` yang mengandung MO name, atau
     - `name` yang mengandung MO name
  3. Simpan `transfer_id` ke tabel `recent_mo`
- **Mengisi tabel**: `recent_mo` (termasuk `transfer_id`)
- **TIDAK mengisi**: `authenticity_used_rm`, `authenticity_used_line`, `manufacturing_identity`

### 5. Asal transfer_id di authenticity_used_rm

**Tabel `authenticity_used_rm` TIDAK diisi dari query Odoo manapun!**

- Tidak ada kode yang INSERT/UPDATE ke `authenticity_used_rm` dari query Odoo
- Kemungkinan besar diisi dari:
  - **Authenticity API eksternal** (lihat `services_authenticity.js` - `fetchAuthenticityByTransferId()`)
  - **Manual input** melalui UI/API
  - **Script terpisah** yang belum ada di codebase ini

**Kesimpulan**: `transfer_id` di `authenticity_used_rm` kemungkinan besar berasal dari Authenticity API eksternal, bukan dari query Odoo.

## Cara Mendapatkan Data Terhubung

### Metode 1: Menggunakan API Endpoint yang Tersedia

Sistem sudah menyediakan endpoint API untuk mengambil data dengan relasi:

#### 1. Get authenticity_used_rm
```bash
GET /api/data/authenticity-used-rm
Query Parameters:
  - transfer_id (optional): Filter by transfer ID
  - authenticity (optional): Filter by authenticity code
  - limit, offset: Pagination
```

#### 2. Get authenticity_used_line
```bash
GET /api/data/authenticity-used-line
Query Parameters:
  - mo_name (optional): Filter by MO name
  - sku_barcode (optional): Filter by SKU barcode
  - limit, offset: Pagination
```

#### 3. Get manufacturing_identity
```bash
GET /api/data/manufacturing-identity
Query Parameters:
  - mo_name (optional): Filter by MO name
  - sku (optional): Filter by SKU
  - limit, offset: Pagination
```

#### 4. Get recent_mo (Tabel Penghubung)
```bash
GET /api/data/recent-mo
Query Parameters:
  - mo_name (optional): Filter by MO name
  - ready (optional): Filter by ready status
  - state (optional): Filter by state
  - limit, offset: Pagination
```

### Metode 2: Query SQL Langsung dengan JOIN

Untuk mendapatkan data `authenticity_used_rm` yang terhubung dengan `authenticity_used_line` dan `manufacturing_identity`, gunakan query SQL berikut:

```sql
-- Query 1: authenticity_used_rm dengan authenticity_used_line
SELECT 
    aurm.id as auth_rm_id,
    aurm.transfer_id,
    aurm.authenticity,
    aurm.transfer_date,
    aul.id as auth_line_id,
    aul.mo_name,
    aul.sku_barcode,
    aul.auth_first_code,
    aul.auth_last_code
FROM authenticity_used_rm aurm
INNER JOIN recent_mo rm ON aurm.transfer_id = rm.transfer_id
INNER JOIN authenticity_used_line aul ON rm.mo_name = aul.mo_name;

-- Query 2: authenticity_used_rm dengan manufacturing_identity
SELECT 
    aurm.id as auth_rm_id,
    aurm.transfer_id,
    aurm.authenticity,
    aurm.transfer_date,
    mi.id as mi_id,
    mi.mo_name,
    mi.sku,
    mi.sku_name,
    mi.target_qty,
    mi.done_qty,
    mi.leader_name
FROM authenticity_used_rm aurm
INNER JOIN recent_mo rm ON aurm.transfer_id = rm.transfer_id
INNER JOIN manufacturing_identity mi ON rm.mo_name = mi.mo_name;

-- Query 3: Semua tabel terhubung (3-way join)
SELECT 
    aurm.id as auth_rm_id,
    aurm.transfer_id,
    aurm.authenticity as rm_authenticity,
    aurm.transfer_date,
    aul.id as auth_line_id,
    aul.mo_name,
    aul.sku_barcode,
    aul.auth_first_code,
    aul.auth_last_code,
    mi.id as mi_id,
    mi.sku,
    mi.sku_name,
    mi.target_qty,
    mi.done_qty,
    mi.leader_name,
    rm.mo_id,
    rm.product_name,
    rm.state as mo_state
FROM authenticity_used_rm aurm
INNER JOIN recent_mo rm ON aurm.transfer_id = rm.transfer_id
LEFT JOIN authenticity_used_line aul ON rm.mo_name = aul.mo_name
LEFT JOIN manufacturing_identity mi ON rm.mo_name = mi.mo_name;
```

### Metode 3: Menggunakan API dengan Multiple Calls

Contoh implementasi Python untuk mendapatkan data terhubung:

```python
import requests

BASE_URL = "https://your-server.com"
TOKEN = "your-session-token"
headers = {"x-session-token": TOKEN}

# 1. Get all recent_mo untuk mendapatkan mapping transfer_id -> mo_name
recent_mo_response = requests.get(
    f"{BASE_URL}/api/data/recent-mo",
    headers=headers,
    params={"limit": 1000}
)
recent_mo_data = recent_mo_response.json()["data"]

# Buat mapping
transfer_to_mo = {mo["transfer_id"]: mo["mo_name"] for mo in recent_mo_data if mo.get("transfer_id")}

# 2. Get authenticity_used_rm
auth_rm_response = requests.get(
    f"{BASE_URL}/api/data/authenticity-used-rm",
    headers=headers,
    params={"limit": 1000}
)
auth_rm_data = auth_rm_response.json()["data"]

# 3. Get authenticity_used_line
auth_line_response = requests.get(
    f"{BASE_URL}/api/data/authenticity-used-line",
    headers=headers,
    params={"limit": 1000}
)
auth_line_data = auth_line_response.json()["data"]

# 4. Get manufacturing_identity
mi_response = requests.get(
    f"{BASE_URL}/api/data/manufacturing-identity",
    headers=headers,
    params={"limit": 1000}
)
mi_data = mi_response.json()["data"]

# 5. Gabungkan data berdasarkan mo_name
result = []
for auth_rm in auth_rm_data:
    transfer_id = auth_rm["transfer_id"]
    mo_name = transfer_to_mo.get(transfer_id)
    
    if mo_name:
        # Cari authenticity_used_line yang sesuai
        auth_line = next(
            (al for al in auth_line_data if al["mo_name"] == mo_name),
            None
        )
        
        # Cari manufacturing_identity yang sesuai
        mi = next(
            (m for m in mi_data if m["mo_name"] == mo_name),
            None
        )
        
        result.append({
            "authenticity_used_rm": auth_rm,
            "mo_name": mo_name,
            "authenticity_used_line": auth_line,
            "manufacturing_identity": mi
        })
```

## Kesimpulan

### 1. Asal transfer_id

**`transfer_id` di tabel `recent_mo`:**
- ✅ **BUKAN berasal dari script standalone** (`query_mrp_production.js`, `query_stock_picking.js`, `query_stock_move.js`)
- ✅ **Berasal dari script sync** (`scripts/sync_recent_mo.js`) yang:
  - Query `mrp.production` untuk mendapatkan data MO
  - Query `stock.picking` untuk mencari `transfer_id` terkait (melalui `origin` atau `name`)
  - Menggunakan `services_odoo.js` (bukan script standalone)

**`transfer_id` di tabel `authenticity_used_rm`:**
- ❌ **TIDAK berasal dari query Odoo manapun**
- ❓ Kemungkinan besar berasal dari:
  - **Authenticity API eksternal** (lihat `services_authenticity.js` - `fetchAuthenticityByTransferId()`)
  - **Manual input** melalui UI/API
  - **Script terpisah** yang belum ada di codebase ini

### 2. Relasi antar tabel
- `authenticity_used_rm` ↔ `authenticity_used_line`: Melalui `recent_mo` (transfer_id → mo_name)
- `authenticity_used_rm` ↔ `manufacturing_identity`: Melalui `recent_mo` (transfer_id → mo_name)

### 3. Cara mendapatkan data terhubung
- ✅ Gunakan API endpoint yang tersedia dan gabungkan di aplikasi
- ✅ Gunakan query SQL dengan JOIN (jika akses langsung ke database)
- ✅ Gunakan tabel `recent_mo` sebagai penghubung

### 4. Catatan Penting
- **Script standalone** (`query_*.js`) hanya untuk testing/debugging, **TIDAK digunakan untuk sync database**
- **Script sync aktif** adalah `scripts/sync_recent_mo.js` yang menggunakan `services_odoo.js`
- Data `authenticity_used_rm` kemungkinan diisi dari **Authenticity API eksternal** (bukan dari Odoo)
- Data `authenticity_used_line` dan `manufacturing_identity` diisi dari **input UI** atau **API endpoint** (bukan dari query Odoo langsung)
- Tabel `recent_mo` adalah **tabel penghubung utama** yang menghubungkan semua tabel ini

## Rekomendasi

Jika Anda perlu mengisi `authenticity_used_rm` dari data Odoo, Anda perlu:
1. Menggunakan `query_stock_picking` untuk mendapatkan `transfer_id`
2. Menggunakan Authenticity API (melalui `services_authenticity.js`) untuk mendapatkan data authenticity berdasarkan `transfer_id`
3. Menyimpan hasilnya ke tabel `authenticity_used_rm`

Contoh implementasi bisa ditambahkan di `scripts/sync_recent_mo.js` atau script terpisah untuk sync authenticity data.

