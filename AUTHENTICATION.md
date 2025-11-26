# Sistem Autentikasi dan Role-Based Access Control

## Overview

Sistem ini sekarang memiliki autentikasi berbasis role dengan dua jenis user:
- **Production** (Orang Produksi)
- **Warehouse** (Orang Warehouse)

## Setup

1. Jalankan migration untuk membuat tabel users dan sessions:
```bash
node scripts/migrate_add_auth.js
```

2. Default credentials:
   - **Production**: username=`production`, password=`password123`
   - **Warehouse**: username=`warehouse`, password=`password123`

⚠️ **PENTING**: Ganti password default di production!

## Role Permissions

### Production (Orang Produksi)
- ✅ Dapat melakukan Start Production
- ✅ Dapat melakukan Changeover
- ✅ Dapat melakukan End Production
- ✅ Dapat Start/Stop Scheduler
- ❌ **TIDAK** dapat mendaftarkan MO (Register MO)

### Warehouse (Orang Warehouse)
- ✅ Dapat mendaftarkan MO siap produksi (Register MO)
- ✅ Dapat Start/Stop Scheduler
- ❌ **TIDAK** dapat melakukan Start/Changeover/End Production

## Cara Menggunakan

1. Buka aplikasi di browser
2. Anda akan diarahkan ke halaman login
3. Pilih role (Production atau Warehouse)
4. Masukkan username dan password
5. Setelah login, fitur yang tersedia akan disesuaikan dengan role Anda

## API Authentication

Semua API endpoints (kecuali `/api/login`) memerlukan header:
```
x-session-token: <session_token>
```

Token disimpan di localStorage browser setelah login berhasil.

## Session Management

- Session token disimpan di database dengan expiry 24 jam
- Token di-generate secara random menggunakan crypto
- Setelah logout, session dihapus dari database

---

## Jawaban Pertanyaan: Session ID dari Cookies

**Pertanyaan**: "Jika saya mendeploy UI ini ke web untuk mendapatkan data dengan API saya membutuhkan session_id web saya dari cookies bukan?"

**Jawaban**: 

Ya, benar! Ada **dua jenis session** yang berbeda:

### 1. Session ID untuk User Login (Aplikasi ini)
- Ini adalah session token yang digunakan untuk autentikasi user di aplikasi ini
- Disimpan di localStorage browser
- Digunakan untuk mengakses API endpoints aplikasi ini
- **TIDAK** sama dengan Odoo session ID

### 2. Odoo Session ID (untuk API Odoo)
- Ini adalah session ID dari Odoo web yang Anda dapatkan dari cookies browser saat login ke Odoo
- Dibutuhkan untuk memanggil API Odoo (misalnya untuk sync data MO)
- Format: biasanya string panjang seperti `bc6b1450c0cd3b05e3ac199521e02f7b639e39ae`
- Cara mendapatkan:
  1. Login ke Odoo web di browser
  2. Buka Developer Tools (F12)
  3. Buka tab Application/Storage → Cookies
  4. Cari cookie dengan nama `session_id`
  5. Copy value-nya

### Cara Menggunakan Odoo Session ID

Saat ini, Odoo Session ID dapat di-set melalui:
1. **Environment variable**: `ODOO_SESSION_ID`
2. **Config file**: `config.js` → `odoo.sessionId`
3. **API saat start scheduler**: Parameter `session_id` di body request

**Catatan Penting**:
- Odoo Session ID memiliki expiry time (biasanya beberapa jam)
- Jika expired, Anda perlu login ulang ke Odoo dan mendapatkan session ID baru
- Untuk production, pertimbangkan menggunakan OAuth2 atau API key yang lebih permanen

### Rekomendasi untuk Production

Untuk deployment production, pertimbangkan:
1. Menggunakan Odoo API dengan API key (jika tersedia)
2. Atau membuat service account di Odoo dengan session yang lebih panjang
3. Atau implementasi auto-refresh session ID jika expired



