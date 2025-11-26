# Fix: Authenticity Used Line Endpoint

## Masalah

Endpoint `/api/data/authenticity-used-line` mengembalikan data kosong karena tabel `authenticity_used_line` tidak terisi data.

## Solusi

Endpoint sekarang mengambil data dari tabel `recent_mo` jika tabel `authenticity_used_line` kosong, karena data authenticity (auth_first, auth_last) sebenarnya tersimpan di `recent_mo`.

## Perilaku Endpoint

### 1. Jika ada data di `authenticity_used_line`
- Mengembalikan data dari tabel `authenticity_used_line`
- Response includes `_source: "authenticity_used_line"`

### 2. Jika `authenticity_used_line` kosong
- Mengambil data dari `recent_mo` yang memiliki `auth_first` atau `auth_last`
- Data di-format sesuai struktur `authenticity_used_line`
- Response includes `_source: "recent_mo"`

## Mapping Data

Data dari `recent_mo` di-mapping ke struktur `authenticity_used_line`:

| recent_mo | authenticity_used_line |
|-----------|----------------------|
| mo_name | mo_name |
| product_name | sku_barcode |
| auth_first | auth_first_code |
| auth_last | auth_last_code |
| date_start (atau created_at) | created_at |

## Contoh Response

### Response dengan data dari recent_mo:

```json
{
  "ok": true,
  "data": [
    {
      "id": null,
      "mo_name": "PROD/MO/27209",
      "sku_barcode": "LITE MANGO",
      "auth_first_code": "1000",
      "auth_last_code": "1095",
      "created_at": "2025-11-26 10:19:18"
    },
    {
      "id": null,
      "mo_name": "PROD/MO/27293",
      "sku_barcode": "BW MATCHA LATTE",
      "auth_first_code": "1100",
      "auth_last_code": "1195",
      "created_at": "2025-11-26 10:18:01"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 100,
    "offset": 0,
    "has_more": false
  },
  "_source": "recent_mo"
}
```

### Response jika ada data di authenticity_used_line:

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "mo_name": "PROD/MO/27209",
      "sku_barcode": "LITE MANGO",
      "auth_first_code": "1000",
      "auth_last_code": "1095",
      "created_at": "2025-11-26 10:19:18"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 100,
    "offset": 0,
    "has_more": false
  },
  "_source": "authenticity_used_line"
}
```

## Filter yang Didukung

- `mo_name`: Filter by MO name (exact match)
- `sku_barcode`: Filter by SKU/product name (LIKE search jika dari recent_mo)
- `limit`: Jumlah data per halaman (default: 100)
- `offset`: Offset untuk pagination (default: 0)

## Contoh Request

```bash
# Get all authenticity used line
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/authenticity-used-line?limit=100"

# Get by MO name
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/authenticity-used-line?mo_name=PROD/MO/27209"

# Get by SKU barcode
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/authenticity-used-line?sku_barcode=LITE MANGO"
```

## Catatan

1. **Field `id`**: Jika data dari `recent_mo`, field `id` akan `null` karena tidak ada ID di recent_mo untuk authenticity_used_line
2. **Field `_source`**: Menunjukkan sumber data (`authenticity_used_line` atau `recent_mo`)
3. **Prioritas**: Endpoint akan selalu cek `authenticity_used_line` dulu, baru fallback ke `recent_mo` jika kosong

## Testing

Setelah update, test endpoint:

```bash
curl -H "x-api-key: mps_da64277ca3c9540e859e8e6025604159" \
  "https://mps.moof-set.web.id/api/data/authenticity-used-line?limit=100"
```

Sekarang seharusnya mengembalikan data dari `recent_mo` yang memiliki `auth_first` atau `auth_last`.

