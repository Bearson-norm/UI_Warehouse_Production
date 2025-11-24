# Local Deployment & Database Access Guide

## Menjalankan di Local

Ya, **sistem ini bisa dijalankan di local** tanpa masalah. Berikut langkah-langkahnya:

### 1. Setup Local

```bash
# Install dependencies
npm install

# Setup database
node scripts/setup_db.js

# Run migration untuk authentication
node scripts/migrate_add_auth.js

# Run migration untuk API keys
node scripts/migrate_add_api_keys.js

# Start server
npm start
```

Server akan berjalan di `http://localhost:3000`

### 2. Akses Aplikasi

- **Web UI:** http://localhost:3000
- **Login:** http://localhost:3000/login
- **Admin (API Key Management):** http://localhost:3000/admin

### 3. Default Credentials

- **Production:** username=`production`, password=`password123`
- **Warehouse:** username=`warehouse`, password=`password123`

---

## Mengakses Database dengan DBeaver

**Ya, bisa langsung dibuka di DBeaver tanpa konfigurasi tambahan!**

### Langkah-langkah:

1. **Buka DBeaver**
2. **Create New Connection** → Pilih **SQLite**
3. **Path ke Database File:**
   - Lokasi default: `warehouse_integrations.db` (di root project)
   - Atau path lengkap: `C:\Users\info\Documents\Project\...\UI_Warehouse_Production\warehouse_integrations.db`

4. **Klik "Test Connection"** → Harusnya berhasil ✅

5. **Klik "Finish"** → Database siap digunakan!

### Struktur Database

Setelah terhubung, Anda akan melihat tabel-tabel berikut:

- `recent_mo` - Data Manufacturing Orders
- `manufacturing_identity` - Identitas manufacturing
- `production_log` - Log produksi
- `master_authenticity_vendor` - Master authenticity vendor
- `authenticity_used_rm` - Authenticity used RM
- `authenticity_used_line` - Authenticity used line
- `users` - User accounts (production/warehouse)
- `sessions` - User sessions
- `api_keys` - API keys untuk external access

### Tips DBeaver

- **Refresh:** Klik kanan database → Refresh untuk melihat perubahan
- **SQL Editor:** Gunakan SQL Editor untuk query langsung
- **Export Data:** Klik kanan tabel → Export Data untuk export ke CSV/Excel

---

## Konfigurasi Database Path

Jika ingin mengubah lokasi database, edit file `config.js`:

```javascript
module.exports = {
  sqlitePath: process.env.SQLITE_PATH || './warehouse_integrations.db',
  // ...
};
```

Atau set environment variable:
```bash
# Windows PowerShell
$env:SQLITE_PATH="C:\path\to\your\database.db"

# Linux/Mac
export SQLITE_PATH="/path/to/your/database.db"
```

---

## Development vs Production

### Local Development
- Database: `warehouse_integrations.db` (SQLite file)
- Server: `http://localhost:3000`
- Tidak perlu konfigurasi khusus

### Production Deployment
- Database: Bisa tetap SQLite atau migrate ke PostgreSQL/MySQL
- Server: Deploy ke cloud (Heroku, AWS, dll)
- Set environment variables untuk konfigurasi

---

## Troubleshooting

### Database locked error
- Pastikan hanya satu instance server yang berjalan
- Tutup DBeaver jika sedang edit data langsung
- Restart server jika perlu

### Database tidak ditemukan
- Pastikan sudah run `node scripts/setup_db.js`
- Cek path di `config.js`
- Pastikan folder memiliki permission write

### DBeaver tidak bisa connect
- Pastikan path database file benar
- Pastikan file database ada (bukan folder)
- Coba buka dengan SQLite browser lain untuk test

---

## Backup Database

Untuk backup database SQLite:

```bash
# Windows PowerShell
Copy-Item warehouse_integrations.db warehouse_integrations_backup.db

# Linux/Mac
cp warehouse_integrations.db warehouse_integrations_backup.db
```

Atau gunakan DBeaver:
1. Klik kanan database → **Tools** → **Backup Database**
2. Pilih lokasi backup
3. Klik **Start**

---

## Restore Database

```bash
# Windows PowerShell
Copy-Item warehouse_integrations_backup.db warehouse_integrations.db

# Linux/Mac
cp warehouse_integrations_backup.db warehouse_integrations.db
```

Atau gunakan DBeaver:
1. Klik kanan database → **Tools** → **Restore Database**
2. Pilih file backup
3. Klik **Start**


