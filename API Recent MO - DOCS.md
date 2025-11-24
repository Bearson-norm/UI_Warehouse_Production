# Warehouse - Recent MO API (Documentation)

Base URL
- http://localhost:3000

Authentication
- Not required (local service). If you need auth, add headers or tokens per your environment.

Endpoints
- POST /api/recent-mo
  - Upsert satu baris di tabel `recent_mo` berdasarkan `mo_name` (wajib).
  - Bila `mo_name` sudah ada → update hanya field yang dikirim.
  - Bila belum ada → insert row baru (minimal dengan `mo_name`).
  - Jika field terkait metrik berubah (`auth_first`, `auth_last`, `initial_qty_target`, `product_qty`), server otomatis menghitung:
    - `auth_used` = (auth_last - auth_first + 1) jika numeric
    - `loss_value` = target - auth_used (target = initial_qty_target, fallback product_qty)
    - `percentage_loss` = 100 * loss_value / target (jika target > 0)
  - Request headers:
    - Content-Type: application/json
  - Request body (JSON):
    - Required:
      - mo_name: string
    - Optional (whitelist fields):
      - mo_id: number
      - state: string (e.g. 'progress', 'done')
      - group_worker_id: number
      - note: string
      - product_id: number
      - product_name: string
      - product_uom: string
      - product_qty: number
      - initial_qty_target: number
      - create_date: string "YYYY-MM-DD HH:MM:SS"
      - date_start: string "YYYY-MM-DD HH:MM:SS"
      - date_finished: string "YYYY-MM-DD HH:MM:SS"
      - origin: string
      - transfer_id: number
      - auth_first: string (numeric preferred)
      - auth_last: string (numeric preferred)
      - leader_id: number|string
      - roll_number: string
      - ready_for_production: 0|1
  - Responses:
    - 200:
      - { "ok": true, "mo_name": "MO/..." }
      - atau { "ok": true, "mo_name": "...", "message": "No fields to update; ensured presence" }
    - 400: { "error": "mo_name is required" } atau validasi lain
    - 500: { "error": "internal error message" }
  - Example body:
    ```json
    {
      "mo_name": "MO/TEST/001",
      "state": "progress",
      "group_worker_id": 6,
      "note": "TEAM LIQUID - SHIFT 1",
      "product_id": 123,
      "product_name": "Sample Product",
      "product_uom": "PCS",
      "product_qty": 1000,
      "initial_qty_target": 1000,
      "create_date": "2025-01-20 08:00:00",
      "origin": "SO123",
      "transfer_id": 98765,
      "auth_first": "10000",
      "auth_last": "10049",
      "leader_id": 77,
      "roll_number": "R-2025-001",
      "ready_for_production": 1
    }
    ```

- GET /api/recent-mo
  - Mengambil semua data dari tabel `recent_mo` dengan filter opsional berdasarkan `create_date`.
  - Query Parameters (semua optional):
    - `create_date_from`: Filter dari tanggal (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
    - `create_date_to`: Filter sampai tanggal (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
    - `limit`: Jumlah maksimal record (default: 500, max: 1000)
  - Response 200: 
    ```json
    {
      "data": [
        {
          "mo_name": "...",
          "product_name": "...",
          "state": "...",
          "create_date": "...",
          "auth_used": 50,
          "loss_value": 950,
          "percentage_loss": 95.0,
          ...
        }
      ],
      "count": 10
    }
    ```
  - Contoh:
    - `GET /api/recent-mo` → semua data (max 500)
    - `GET /api/recent-mo?create_date_from=2025-01-15&create_date_to=2025-01-20` → filter tanggal
    - `GET /api/recent-mo?create_date_from=2025-01-15&limit=100` → filter dari tanggal + limit

- GET /api/ready-mo
  - Mengambil daftar MO yang siap produksi (ready_for_production=1) dan belum start (`date_start` kosong).
  - Query Parameters (optional):
    - `create_date_from`: Filter dari tanggal (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
    - `create_date_to`: Filter sampai tanggal (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
  - Response 200: { "data": [ { mo_name, product_name, product_uom, product_qty, auth_first, roll_number, create_date }, ... ] }
  - Contoh:
    - `GET /api/ready-mo` → semua MO siap produksi
    - `GET /api/ready-mo?create_date_from=2025-01-15&create_date_to=2025-01-20` → filter tanggal

- GET /api/running-mo
  - Mengambil daftar MO yang sedang berjalan: `date_start` terisi, `date_finished` kosong, dan `state` bukan 'done'.
  - Query Parameters (optional):
    - `create_date_from`: Filter dari tanggal (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
    - `create_date_to`: Filter sampai tanggal (format: `YYYY-MM-DD` atau `YYYY-MM-DD HH:MM:SS`)
  - Response 200: { "data": [ { mo_name, product_name, product_uom, product_qty, auth_first, auth_last, roll_number, date_start, create_date }, ... ] }
  - Contoh:
    - `GET /api/running-mo` → semua MO berjalan
    - `GET /api/running-mo?create_date_from=2025-01-15&create_date_to=2025-01-20` → filter tanggal

Notes
- Waktu (date_start, date_finished, log create_at) disimpan menggunakan zona waktu lokal yang dapat dikonfigurasi via `TIMEZONE_OFFSET_MINUTES` (default 420 = UTC+7).
- Ada pembersihan otomatis data `recent_mo` yang `create_date` lebih tua dari 7 hari pada akhir proses sync Odoo (`scripts/sync_recent_mo.js`).

Postman Collection
- File: `API Recent MO.postman_collection.json`
  - Upsert Recent MO (POST /api/recent-mo)
  - Get All Recent MO (GET /api/recent-mo) - dengan contoh query parameters untuk filter create_date
  - Get Ready MO (GET /api/ready-mo) - dengan contoh query parameters untuk filter create_date
  - Get Running MO (GET /api/running-mo) - dengan contoh query parameters untuk filter create_date


