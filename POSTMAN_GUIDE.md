# Panduan Menggunakan API dengan Postman

Panduan lengkap untuk mengakses Manufacturing Process System API menggunakan Postman dengan API Key.

## 📋 Informasi API

- **Base URL:** `https://mps.moof-set.web.id`
- **API Key:** `mps_da64277ca3c9540e859e8e6025604159`

---

## 🚀 Setup Postman

### 1. Install Postman

Jika belum punya, download dari: https://www.postman.com/downloads/

### 2. Create New Collection (Opsional)

1. Klik **"New"** → **"Collection"**
2. Nama: `Manufacturing Process System API`
3. Klik **"Create"**

---

## 🔑 Setup API Key di Postman

Ada 2 cara untuk setup API key:

### Cara 1: Set di Collection Level (Recommended)

1. Klik kanan pada Collection → **"Edit"**
2. Pilih tab **"Variables"**
3. Tambahkan variable:
   - **Variable:** `api_key`
   - **Initial Value:** `mps_da64277ca3c9540e859e8e6025604159`
   - **Current Value:** `mps_da64277ca3c9540e859e8e6025604159`
4. Klik **"Save"**

5. Di tab **"Authorization"**:
   - Type: **"API Key"**
   - Key: `x-api-key`
   - Value: `{{api_key}}`
   - Add to: **"Header"**

### Cara 2: Set di Environment (Alternatif)

1. Klik **"Environments"** (icon kiri atas)
2. Klik **"+"** untuk create environment baru
3. Nama: `MPS Production`
4. Tambahkan variable:
   - **Variable:** `api_key`
   - **Initial Value:** `mps_da64277ca3c9540e859e8e6025604159`
   - **Current Value:** `mps_da64277ca3c9540e859e8e6025604159`
5. Klik **"Save"**
6. Pilih environment `MPS Production` di dropdown kanan atas

---

## 📝 Membuat Request

### Request 1: Get Recent MO Data

**Method:** `GET`

**URL:**
```
https://mps.moof-set.web.id/api/data/recent-mo
```

**Headers:**
```
x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

**Query Parameters (Optional):**
- `limit`: `50` (jumlah data per halaman)
- `offset`: `0` (offset untuk pagination)
- `ready`: `true` (filter hanya yang ready)
- `state`: `progress` (filter by state)

**Cara Setup:**
1. Klik **"New"** → **"HTTP Request"**
2. Method: **GET**
3. URL: `https://mps.moof-set.web.id/api/data/recent-mo`
4. Klik tab **"Params"** (Query Params):
   - Key: `limit`, Value: `50`
   - Key: `ready`, Value: `true`
5. Klik tab **"Headers"**:
   - Key: `x-api-key`, Value: `mps_da64277ca3c9540e859e8e6025604159`
6. Klik **"Send"**

**Expected Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "mo_name": "MO/001",
      "product_name": "Product A",
      "product_qty": 100,
      "ready_for_production": 1,
      ...
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

---

### Request 2: Get Manufacturing Identity

**Method:** `GET`

**URL:**
```
https://mps.moof-set.web.id/api/data/manufacturing-identity
```

**Headers:**
```
x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

**Query Parameters (Optional):**
- `limit`: `50`
- `offset`: `0`
- `mo_name`: `MO/001` (filter by MO name)
- `sku`: `SKU001` (filter by SKU)

**Cara Setup:**
1. Method: **GET**
2. URL: `https://mps.moof-set.web.id/api/data/manufacturing-identity`
3. Headers: `x-api-key: mps_da64277ca3c9540e859e8e6025604159`
4. Query Params (opsional): tambahkan filter sesuai kebutuhan
5. Klik **"Send"**

---

### Request 3: Get Production Log

**Method:** `GET`

**URL:**
```
https://mps.moof-set.web.id/api/data/production-log
```

**Headers:**
```
x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

**Query Parameters (Optional):**
- `limit`: `50`
- `offset`: `0`
- `mo_name`: `MO/001`
- `status`: `start` atau `end`
- `from_date`: `2024-01-15` (format: YYYY-MM-DD)
- `to_date`: `2024-01-20`

**Cara Setup:**
1. Method: **GET**
2. URL: `https://mps.moof-set.web.id/api/data/production-log`
3. Headers: `x-api-key: mps_da64277ca3c9540e859e8e6025604159`
4. Query Params: 
   - `status`: `start`
   - `from_date`: `2024-01-15`
5. Klik **"Send"**

---

### Request 4: Get Master Authenticity Vendor

**Method:** `GET`

**URL:**
```
https://mps.moof-set.web.id/api/data/master-authenticity-vendor
```

**Headers:**
```
x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

---

### Request 5: Get Authenticity Used RM

**Method:** `GET`

**URL:**
```
https://mps.moof-set.web.id/api/data/authenticity-used-rm
```

**Headers:**
```
x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

---

### Request 6: Get Authenticity Used Line

**Method:** `GET`

**URL:**
```
https://mps.moof-set.web.id/api/data/authenticity-used-line
```

**Headers:**
```
x-api-key: mps_da64277ca3c9540e859e8e6025604159
```

---

## 🔄 Menggunakan Authorization Bearer (Alternatif)

Selain `x-api-key`, Anda juga bisa menggunakan format `Authorization: Bearer`:

**Headers:**
```
Authorization: Bearer mps_da64277ca3c9540e859e8e6025604159
```

**Cara Setup di Postman:**
1. Klik tab **"Authorization"**
2. Type: **"Bearer Token"**
3. Token: `mps_da64277ca3c9540e859e8e6025604159`
4. Klik **"Send"**

---

## 📦 Import Postman Collection

Untuk memudahkan, Anda bisa import collection yang sudah disiapkan:

### Langkah Import:

**Cara 1: Import dari File**
1. **Buka Postman** → Klik **"Import"** (kiri atas)
2. Pilih tab **"File"** atau **"Upload Files"**
3. Pilih file `Manufacturing_Process_System_API.postman_collection.json`
4. Klik **"Import"**

**Cara 2: Import dari Raw Text**
1. **Buka Postman** → Klik **"Import"** (kiri atas)
2. Pilih tab **"Raw text"**
3. Copy-paste JSON collection di bawah ini
4. Klik **"Import"**

**File Collection:** `Manufacturing_Process_System_API.postman_collection.json` sudah tersedia di root project.

### Postman Collection JSON:

```json
{
  "info": {
    "name": "Manufacturing Process System API",
    "description": "API untuk Manufacturing Process System - mps.moof-set.web.id",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://mps.moof-set.web.id",
      "type": "string"
    },
    {
      "key": "api_key",
      "value": "mps_da64277ca3c9540e859e8e6025604159",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Get Recent MO",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-api-key",
            "value": "{{api_key}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/data/recent-mo?limit=50&ready=true",
          "host": ["{{base_url}}"],
          "path": ["api", "data", "recent-mo"],
          "query": [
            {
              "key": "limit",
              "value": "50"
            },
            {
              "key": "ready",
              "value": "true"
            }
          ]
        }
      }
    },
    {
      "name": "Get Manufacturing Identity",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-api-key",
            "value": "{{api_key}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/data/manufacturing-identity?limit=50",
          "host": ["{{base_url}}"],
          "path": ["api", "data", "manufacturing-identity"],
          "query": [
            {
              "key": "limit",
              "value": "50"
            }
          ]
        }
      }
    },
    {
      "name": "Get Production Log",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-api-key",
            "value": "{{api_key}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/data/production-log?limit=50&status=start",
          "host": ["{{base_url}}"],
          "path": ["api", "data", "production-log"],
          "query": [
            {
              "key": "limit",
              "value": "50"
            },
            {
              "key": "status",
              "value": "start"
            }
          ]
        }
      }
    },
    {
      "name": "Get Master Authenticity Vendor",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-api-key",
            "value": "{{api_key}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/data/master-authenticity-vendor?limit=50",
          "host": ["{{base_url}}"],
          "path": ["api", "data", "master-authenticity-vendor"],
          "query": [
            {
              "key": "limit",
              "value": "50"
            }
          ]
        }
      }
    },
    {
      "name": "Get Authenticity Used RM",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-api-key",
            "value": "{{api_key}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/data/authenticity-used-rm?limit=50",
          "host": ["{{base_url}}"],
          "path": ["api", "data", "authenticity-used-rm"],
          "query": [
            {
              "key": "limit",
              "value": "50"
            }
          ]
        }
      }
    },
    {
      "name": "Get Authenticity Used Line",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-api-key",
            "value": "{{api_key}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/data/authenticity-used-line?limit=50",
          "host": ["{{base_url}}"],
          "path": ["api", "data", "authenticity-used-line"],
          "query": [
            {
              "key": "limit",
              "value": "50"
            }
          ]
        }
      }
    }
  ]
}
```

---

## ✅ Testing Request

### Quick Test:

1. **Buka Postman**
2. **New Request** → Method: **GET**
3. **URL:** `https://mps.moof-set.web.id/api/data/recent-mo?limit=10`
4. **Headers:**
   - Key: `x-api-key`
   - Value: `mps_da64277ca3c9540e859e8e6025604159`
5. **Klik "Send"**

**Expected Result:**
- Status: `200 OK`
- Response body berisi JSON dengan data recent MO

---

## 🐛 Troubleshooting

### Error 401: Unauthorized

**Penyebab:**
- API key salah atau tidak ada di header
- API key sudah di-deactivate

**Solusi:**
1. Pastikan header `x-api-key` sudah benar
2. Cek API key di halaman admin: `https://mps.moof-set.web.id/admin`
3. Pastikan API key status adalah "Active"

### Error 404: Not Found

**Penyebab:**
- URL endpoint salah
- Server tidak running

**Solusi:**
1. Pastikan URL benar: `https://mps.moof-set.web.id/api/data/...`
2. Cek apakah server masih running

### Error 500: Internal Server Error

**Penyebab:**
- Server error
- Database issue

**Solusi:**
1. Cek server logs
2. Hubungi administrator

---

## 📸 Screenshot Guide

### 1. Setup Header di Postman

```
┌─────────────────────────────────────┐
│ Headers                              │
├─────────────────────────────────────┤
│ KEY              VALUE              │
│ x-api-key        mps_da64277c...    │
└─────────────────────────────────────┘
```

### 2. Setup Query Params

```
┌─────────────────────────────────────┐
│ Params                              │
├─────────────────────────────────────┤
│ KEY              VALUE    ✓        │
│ limit            50       ✓        │
│ ready            true     ✓        │
└─────────────────────────────────────┘
```

### 3. Response Success

```
Status: 200 OK
Time: 234ms
Size: 2.5 KB

{
  "ok": true,
  "data": [...],
  "pagination": {...}
}
```

---

## 🔗 Quick Links

- **Base URL:** https://mps.moof-set.web.id
- **Admin Panel:** https://mps.moof-set.web.id/admin
- **API Documentation:** Lihat `API_DOCUMENTATION.md`

---

## 💡 Tips

1. **Save Request:** Setelah setup, klik **"Save"** untuk menyimpan request
2. **Use Variables:** Gunakan collection variables untuk mudah update API key
3. **Test Collection:** Klik **"Run"** untuk test semua requests sekaligus
4. **Export Collection:** Export collection untuk backup atau share dengan team

---

**Selamat menggunakan API! 🚀**

