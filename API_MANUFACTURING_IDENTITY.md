# API Documentation: Manufacturing Identity

Dokumentasi lengkap untuk endpoint `GET /api/data/manufacturing-identity` dengan filter berdasarkan `created_at` dan `finished_at`.

## 📋 Informasi Endpoint

- **Base URL:** `https://mps.moof-set.web.id`
- **Endpoint:** `GET /api/data/manufacturing-identity`
- **Authentication:** API Key (header `x-api-key`)

---

## 🔑 Authentication

Semua request memerlukan API Key di header:

```
x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

Atau menggunakan Authorization Bearer:

```
Authorization: Bearer mps_da64277ca3c9540e859e8e6025604159
```

---

## 📝 Query Parameters

### Pagination (Required)
- `limit` (optional): Jumlah data per halaman (default: 100, max: 1000)
- `offset` (optional): Offset untuk pagination (default: 0)

### Filter (Optional)
- `mo_name` (optional): Filter by MO name (exact match)
- `sku` (optional): Filter by SKU code (exact match)
- `created_at_from` (optional): Filter from created_at (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
- `created_at_to` (optional): Filter to created_at (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
- `finished_at_from` (optional): Filter from finished_at (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
- `finished_at_to` (optional): Filter to finished_at (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)

---

## 📊 Contoh Request

### 1. Get All Manufacturing Identity

**Request:**
```http
GET https://mps.moof-set.web.id/api/data/manufacturing-identity?limit=50&offset=0
Headers:
  x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

**cURL:**
```bash
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/manufacturing-identity?limit=50&offset=0"
```

---

### 2. Get Manufacturing Identity by Created At (Date Range)

**Request:**
```http
GET https://mps.moof-set.web.id/api/data/manufacturing-identity?created_at_from=2024-01-15&created_at_to=2024-01-20&limit=100
Headers:
  x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

**cURL:**
```bash
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/manufacturing-identity?created_at_from=2024-01-15&created_at_to=2024-01-20&limit=100"
```

**Penjelasan:**
- Mengambil data yang `created_at` antara `2024-01-15 00:00:00` sampai `2024-01-20 23:59:59`

---

### 3. Get Manufacturing Identity by Finished At (Date Range)

**Request:**
```http
GET https://mps.moof-set.web.id/api/data/manufacturing-identity?finished_at_from=2024-01-15&finished_at_to=2024-01-20&limit=100
Headers:
  x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

**cURL:**
```bash
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/manufacturing-identity?finished_at_from=2024-01-15&finished_at_to=2024-01-20&limit=100"
```

**Penjelasan:**
- Mengambil data yang `finished_at` antara `2024-01-15 00:00:00` sampai `2024-01-20 23:59:59`
- Hanya data yang sudah selesai (finished_at tidak null)

---

### 4. Get Manufacturing Identity by Created At (Single Date)

**Request:**
```http
GET https://mps.moof-set.web.id/api/data/manufacturing-identity?created_at_from=2024-01-15&created_at_to=2024-01-15&limit=100
Headers:
  x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

**Penjelasan:**
- Mengambil data yang dibuat pada tanggal `2024-01-15` saja

---

### 5. Get Manufacturing Identity by Created At (With Time)

**Request:**
```http
GET https://mps.moof-set.web.id/api/data/manufacturing-identity?created_at_from=2024-01-15 08:00:00&created_at_to=2024-01-15 17:00:00&limit=100
Headers:
  x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

**Penjelasan:**
- Mengambil data yang dibuat antara `2024-01-15 08:00:00` sampai `2024-01-15 17:00:00`

---

### 6. Combined Filters (Created At + MO Name)

**Request:**
```http
GET https://mps.moof-set.web.id/api/data/manufacturing-identity?mo_name=MO/001&created_at_from=2024-01-15&created_at_to=2024-01-20&limit=100
Headers:
  x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

**Penjelasan:**
- Mengambil data dengan MO name `MO/001` yang dibuat antara `2024-01-15` sampai `2024-01-20`

---

## ✅ Response OK (Success)

### Status Code: `200 OK`

### Response Body:

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "mo_name": "MO/001",
      "sku": "SKU001",
      "sku_name": "Product A",
      "target_qty": 100,
      "done_qty": 95,
      "leader_name": "001",
      "started_at": "2024-01-15 08:00:00",
      "finished_at": "2024-01-15 16:30:00",
      "created_at": "2024-01-15 08:00:00"
    },
    {
      "id": 2,
      "mo_name": "MO/002",
      "sku": "SKU002",
      "sku_name": "Product B",
      "target_qty": 200,
      "done_qty": null,
      "leader_name": "002",
      "started_at": "2024-01-16 09:00:00",
      "finished_at": null,
      "created_at": "2024-01-16 09:00:00"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 100,
    "offset": 0,
    "has_more": false
  }
}
```

### Field Descriptions:

- `ok`: `true` jika request berhasil
- `data`: Array of manufacturing identity records
  - `id`: Primary key
  - `mo_name`: Manufacturing Order name
  - `sku`: SKU code
  - `sku_name`: SKU/product name
  - `target_qty`: Target quantity
  - `done_qty`: Done quantity (null jika belum selesai)
  - `leader_name`: Leader ID/name
  - `started_at`: Waktu mulai produksi (format: `YYYY-MM-DD HH:MM:SS`)
  - `finished_at`: Waktu selesai produksi (format: `YYYY-MM-DD HH:MM:SS`, null jika belum selesai)
  - `created_at`: Waktu record dibuat (format: `YYYY-MM-DD HH:MM:SS`)
- `pagination`: Pagination information
  - `total`: Total records yang match filter
  - `limit`: Jumlah data per halaman
  - `offset`: Offset yang digunakan
  - `has_more`: `true` jika masih ada data berikutnya

---

## ❌ Response Error

### 1. Error 401: Unauthorized

**Status Code:** `401 Unauthorized`

**Response Body:**
```json
{
  "error": "Unauthorized: No session token or API key provided"
}
```

**Penyebab:**
- API key tidak ada di header
- API key salah atau invalid
- API key sudah di-deactivate

**Solusi:**
- Pastikan header `x-api-key` sudah ditambahkan
- Cek API key di halaman admin: `https://mps.moof-set.web.id/admin`
- Pastikan API key status adalah "Active"

---

### 2. Error 400: Bad Request

**Status Code:** `400 Bad Request`

**Response Body:**
```json
{
  "error": "Invalid parameter: limit must be a number"
}
```

**Penyebab:**
- Parameter tidak valid (misalnya limit bukan angka)
- Format tanggal salah

**Solusi:**
- Pastikan `limit` dan `offset` adalah angka
- Pastikan format tanggal: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`

---

### 3. Error 500: Internal Server Error

**Status Code:** `500 Internal Server Error`

**Response Body:**
```json
{
  "error": "Database error: SQLITE_ERROR: no such column: invalid_column"
}
```

**Penyebab:**
- Server error
- Database error
- Internal application error

**Solusi:**
- Coba request lagi setelah beberapa saat
- Hubungi administrator jika error berlanjut

---

## 📋 Contoh Response Lainnya

### Response: No Data Found

**Status Code:** `200 OK`

**Response Body:**
```json
{
  "ok": true,
  "data": [],
  "pagination": {
    "total": 0,
    "limit": 100,
    "offset": 0,
    "has_more": false
  }
}
```

**Penjelasan:**
- Request berhasil, tapi tidak ada data yang match dengan filter

---

### Response: With Pagination (Has More)

**Status Code:** `200 OK`

**Response Body:**
```json
{
  "ok": true,
  "data": [
    // ... 100 records
  ],
  "pagination": {
    "total": 250,
    "limit": 100,
    "offset": 0,
    "has_more": true
  }
}
```

**Penjelasan:**
- Total ada 250 records
- Menampilkan 100 records pertama (offset 0)
- Masih ada 150 records berikutnya (`has_more: true`)

**Untuk mengambil data berikutnya:**
```http
GET ...?limit=100&offset=100
```

---

## 🔍 Contoh Use Cases

### Use Case 1: Get Manufacturing Identity Created Today

**Request:**
```bash
# Get today's date (2024-01-15)
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/manufacturing-identity?created_at_from=2024-01-15&created_at_to=2024-01-15&limit=100"
```

---

### Use Case 2: Get Manufacturing Identity Finished This Week

**Request:**
```bash
# Week: 2024-01-15 to 2024-01-21
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/manufacturing-identity?finished_at_from=2024-01-15&finished_at_to=2024-01-21&limit=100"
```

---

### Use Case 3: Get Manufacturing Identity Created Last Month

**Request:**
```bash
# Last month: 2024-01-01 to 2024-01-31
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/manufacturing-identity?created_at_from=2024-01-01&created_at_to=2024-01-31&limit=100"
```

---

### Use Case 4: Get Manufacturing Identity by MO Name and Date Range

**Request:**
```bash
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/manufacturing-identity?mo_name=MO/001&created_at_from=2024-01-15&created_at_to=2024-01-20&limit=100"
```

---

## 📝 Notes

1. **Date Format:**
   - Format tanggal: `YYYY-MM-DD` (contoh: `2024-01-15`)
   - Format datetime: `YYYY-MM-DD HH:MM:SS` (contoh: `2024-01-15 08:30:00`)
   - Timezone: Asia/Jakarta (UTC+7)

2. **Date Range:**
   - `created_at_from`: Filter `created_at >= value`
   - `created_at_to`: Filter `created_at <= value`
   - `finished_at_from`: Filter `finished_at >= value`
   - `finished_at_to`: Filter `finished_at <= value`

3. **Combined Filters:**
   - Semua filter bisa dikombinasikan (AND logic)
   - Contoh: `mo_name` + `created_at_from` + `created_at_to`

4. **Pagination:**
   - Default `limit`: 100
   - Default `offset`: 0
   - Max `limit`: 1000 (disarankan max 100 untuk performa)

5. **Null Values:**
   - `finished_at` bisa `null` jika produksi belum selesai
   - `done_qty` bisa `null` jika belum ada data

---

## 🧪 Testing dengan Postman

1. Import collection: `Manufacturing_Process_System_API.postman_collection.json`
2. Buka request: **Manufacturing Identity → Get Manufacturing Identity by Created At**
3. Edit query parameters sesuai kebutuhan
4. Klik **Send**

---

## 📞 Support

Jika ada pertanyaan atau issue:
- Cek dokumentasi lengkap: `API_DOCUMENTATION.md`
- Cek Postman Guide: `POSTMAN_GUIDE.md`
- Hubungi administrator

---

**Last Updated:** 2025-01-XX  
**Version:** 1.0.0


