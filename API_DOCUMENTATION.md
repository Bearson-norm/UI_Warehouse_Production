# API Documentation - Manufacturing Process System

Dokumentasi ini menjelaskan cara menggunakan API untuk mengambil data dari Manufacturing Process System yang sudah di-deploy di web.

## Base URL

Ganti `https://your-server.com` dengan URL server Anda yang sudah di-deploy.

```
https://your-server.com
```

## Authentication

Semua API endpoints memerlukan authentication. Ada **2 metode** yang didukung:

### Metode 1: Session Token (User Login)
Untuk akses dari web browser atau aplikasi yang memerlukan user login.

### Metode 2: API Key (Recommended untuk External Access)
Untuk akses dari device/application eksternal tanpa perlu user login.

---

## Metode 1: Session Token

### 1. Login untuk mendapatkan token

**Endpoint:** `POST /api/login`

**Request Body:**
```json
{
  "username": "production",
  "password": "password123"
}
```

**Response:**
```json
{
  "ok": true,
  "token": "abc123def456...",
  "user": {
    "username": "production",
    "role": "production"
  }
}
```

**Gunakan token ini di header semua request berikutnya:**
```
x-session-token: abc123def456...
```

### 2. Logout

**Endpoint:** `POST /api/logout`

**Headers:**
```
x-session-token: <your-token>
```

---

## Metode 2: API Key (Recommended untuk External Access)

### 1. Generate API Key

**Akses halaman admin:** `https://your-server.com/admin`

Atau gunakan API endpoint (setelah login dengan session token):

**Endpoint:** `POST /api/admin/api-keys`

**Headers:**
```
x-session-token: <your-session-token>
```

**Request Body:**
```json
{
  "key_name": "Production Device 1",
  "description": "API key untuk device produksi di line 1"
}
```

**Response:**
```json
{
  "ok": true,
  "api_key": "mps_abc123def456...",
  "message": "API key created successfully. Save this key - it will not be shown again!"
}
```

⚠️ **PENTING:** Simpan API key ini sekarang! Key ini tidak akan ditampilkan lagi.

### 2. Menggunakan API Key

Gunakan API key di header request dengan salah satu format berikut:

**Format 1: x-api-key header**
```
x-api-key: mps_abc123def456...
```

**Format 2: Authorization Bearer**
```
Authorization: Bearer mps_abc123def456...
```

**Contoh:**
```bash
curl -H "x-api-key: mps_abc123def456..." \
  https://your-server.com/api/data/recent-mo
```

### 3. Manage API Keys

**List semua API keys:**
```
GET /api/admin/api-keys
Headers: x-session-token: <your-session-token>
```

**Toggle aktif/nonaktif:**
```
POST /api/admin/api-keys/:id/toggle
Headers: x-session-token: <your-session-token>
```

**Hapus API key:**
```
DELETE /api/admin/api-keys/:id
Headers: x-session-token: <your-session-token>
```

---

## Data Export Endpoints

Semua endpoint data export menggunakan format response yang sama:

**Response Format:**
```json
{
  "ok": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

### Query Parameters (Umum)

- `limit` (optional): Jumlah data per halaman (default: 100, max: 1000)
- `offset` (optional): Offset untuk pagination (default: 0)

---

## 1. Recent MO Data

**Endpoint:** `GET /api/data/recent-mo`

**Headers:**
```
x-session-token: <your-token>
```

**Query Parameters:**
- `limit` (optional): Jumlah data (default: 100)
- `offset` (optional): Offset (default: 0)
- `mo_name` (optional): Filter by MO name
- `ready` (optional): Filter by ready status (`true` atau `false`)
- `state` (optional): Filter by state (e.g., `progress`, `done`)

**Contoh Request:**
```bash
curl -H "x-session-token: YOUR_TOKEN" \
  "https://your-server.com/api/data/recent-mo?limit=50&ready=true"
```

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "mo_id": 123,
      "mo_name": "MO/001",
      "state": "progress",
      "ready_for_production": 1,
      "product_name": "Product A",
      "product_qty": 100,
      "date_start": "2024-01-15 08:00:00",
      "date_finished": null,
      "auth_first": "1000",
      "auth_last": null,
      "leader_id": "001",
      "roll_number": "R001",
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

## 2. Manufacturing Identity Data

**Endpoint:** `GET /api/data/manufacturing-identity`

**Query Parameters:**
- `limit` (optional): Jumlah data (default: 100)
- `offset` (optional): Offset (default: 0)
- `mo_name` (optional): Filter by MO name
- `sku` (optional): Filter by SKU

**Contoh Request:**
```bash
curl -H "x-session-token: YOUR_TOKEN" \
  "https://your-server.com/api/data/manufacturing-identity?mo_name=MO/001"
```

**Response:**
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
      "finished_at": null,
      "created_at": "2024-01-15 08:00:00"
    }
  ],
  "pagination": {...}
}
```

---

## 3. Production Log Data

**Endpoint:** `GET /api/data/production-log`

**Query Parameters:**
- `limit` (optional): Jumlah data (default: 100)
- `offset` (optional): Offset (default: 0)
- `mo_name` (optional): Filter by MO name
- `status` (optional): Filter by status (`start` atau `end`)
- `from_date` (optional): Filter from date (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
- `to_date` (optional): Filter to date (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)

**Contoh Request:**
```bash
curl -H "x-session-token: YOUR_TOKEN" \
  "https://your-server.com/api/data/production-log?status=start&from_date=2024-01-15"
```

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "mo_name": "MO/001",
      "product_name": "Product A",
      "leader_id": "001",
      "status": "start",
      "create_at": "2024-01-15 08:00:00"
    }
  ],
  "pagination": {...}
}
```

---

## 4. Master Authenticity Vendor Data

**Endpoint:** `GET /api/data/master-authenticity-vendor`

**Query Parameters:**
- `limit` (optional): Jumlah data (default: 100)
- `offset` (optional): Offset (default: 0)
- `roll` (optional): Filter by roll number
- `authenticity` (optional): Filter by authenticity code

**Contoh Request:**
```bash
curl -H "x-session-token: YOUR_TOKEN" \
  "https://your-server.com/api/data/master-authenticity-vendor?roll=R001"
```

---

## 5. Authenticity Used RM Data

**Endpoint:** `GET /api/data/authenticity-used-rm`

**Query Parameters:**
- `limit` (optional): Jumlah data (default: 100)
- `offset` (optional): Offset (default: 0)
- `transfer_id` (optional): Filter by transfer ID
- `authenticity` (optional): Filter by authenticity code

**Contoh Request:**
```bash
curl -H "x-session-token: YOUR_TOKEN" \
  "https://your-server.com/api/data/authenticity-used-rm?transfer_id=123"
```

---

## 6. Authenticity Used Line Data

**Endpoint:** `GET /api/data/authenticity-used-line`

**Query Parameters:**
- `limit` (optional): Jumlah data (default: 100)
- `offset` (optional): Offset (default: 0)
- `mo_name` (optional): Filter by MO name
- `sku_barcode` (optional): Filter by SKU barcode

**Contoh Request:**
```bash
curl -H "x-session-token: YOUR_TOKEN" \
  "https://your-server.com/api/data/authenticity-used-line?mo_name=MO/001"
```

---

## Contoh Implementasi (Python)

```python
import requests

# Base URL
BASE_URL = "https://your-server.com"

# 1. Login
login_response = requests.post(
    f"{BASE_URL}/api/login",
    json={
        "username": "production",
        "password": "password123"
    }
)
token = login_response.json()["token"]

# 2. Get Recent MO Data
headers = {"x-session-token": token}
response = requests.get(
    f"{BASE_URL}/api/data/recent-mo",
    headers=headers,
    params={"limit": 50, "ready": "true"}
)

data = response.json()
print(f"Total: {data['pagination']['total']}")
for mo in data['data']:
    print(f"MO: {mo['mo_name']}, Product: {mo['product_name']}")

# 3. Get Manufacturing Identity
response = requests.get(
    f"{BASE_URL}/api/data/manufacturing-identity",
    headers=headers
)
manufacturing_data = response.json()["data"]

# 4. Get Production Log
response = requests.get(
    f"{BASE_URL}/api/data/production-log",
    headers=headers,
    params={"status": "start", "from_date": "2024-01-15"}
)
logs = response.json()["data"]
```

---

## Contoh Implementasi (JavaScript/Node.js)

```javascript
const axios = require('axios');

const BASE_URL = 'https://your-server.com';

async function fetchData() {
  // 1. Login
  const loginRes = await axios.post(`${BASE_URL}/api/login`, {
    username: 'production',
    password: 'password123'
  });
  const token = loginRes.data.token;

  // 2. Get Recent MO
  const headers = { 'x-session-token': token };
  const moRes = await axios.get(`${BASE_URL}/api/data/recent-mo`, {
    headers,
    params: { limit: 50, ready: 'true' }
  });
  console.log('Recent MO:', moRes.data.data);

  // 3. Get Manufacturing Identity
  const miRes = await axios.get(`${BASE_URL}/api/data/manufacturing-identity`, {
    headers
  });
  console.log('Manufacturing Identity:', miRes.data.data);

  // 4. Get Production Log
  const logRes = await axios.get(`${BASE_URL}/api/data/production-log`, {
    headers,
    params: { status: 'start', from_date: '2024-01-15' }
  });
  console.log('Production Log:', logRes.data.data);
}

fetchData().catch(console.error);
```

---

## Error Handling

Semua endpoint mengembalikan error dengan format:

```json
{
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid or missing token)
- `403`: Forbidden (insufficient permissions)
- `500`: Internal Server Error

**Contoh Error Response:**
```json
{
  "error": "Unauthorized: Invalid or expired session"
}
```

---

## Pagination

Untuk mengambil semua data, gunakan pagination:

```python
def fetch_all_data(endpoint, headers, params=None):
    all_data = []
    offset = 0
    limit = 100
    
    while True:
        response = requests.get(
            endpoint,
            headers=headers,
            params={**(params or {}), "limit": limit, "offset": offset}
        )
        data = response.json()
        all_data.extend(data["data"])
        
        if not data["pagination"]["has_more"]:
            break
        offset += limit
    
    return all_data
```

---

## Rate Limiting

Saat ini tidak ada rate limiting, namun disarankan untuk:
- Tidak melakukan request terlalu sering (minimal 1 detik antar request)
- Menggunakan pagination dengan limit yang wajar (max 1000 per request)
- Cache data jika memungkinkan

---

## Security Notes

1. **Jangan hardcode token** di code production
2. **Simpan token** di environment variable atau secure storage
3. **Refresh token** jika expired (login ulang)
4. **Gunakan HTTPS** untuk semua request di production
5. **Jangan commit** credentials ke version control

