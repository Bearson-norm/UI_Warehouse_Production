#!/bin/bash
# Contoh script bash/curl untuk mengambil data dari Manufacturing Process System API

# Konfigurasi
BASE_URL="${API_BASE_URL:-http://localhost:3000}"
USERNAME="${API_USERNAME:-production}"
PASSWORD="${API_PASSWORD:-password123}"

echo "🔐 Login ke API..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login gagal!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login berhasil!"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Headers untuk request berikutnya
HEADERS=(-H "x-session-token: ${TOKEN}")

echo "=" | tr -d '\n' | head -c 50
echo ""
echo "Mengambil data Recent MO..."
echo "=" | tr -d '\n' | head -c 50
echo ""

curl -s "${HEADERS[@]}" \
  "${BASE_URL}/api/data/recent-mo?limit=10&ready=true" | \
  python3 -m json.tool 2>/dev/null || \
  python -m json.tool 2>/dev/null || \
  cat

echo ""
echo "=" | tr -d '\n' | head -c 50
echo ""
echo "Mengambil data Manufacturing Identity..."
echo "=" | tr -d '\n' | head -c 50
echo ""

curl -s "${HEADERS[@]}" \
  "${BASE_URL}/api/data/manufacturing-identity?limit=10" | \
  python3 -m json.tool 2>/dev/null || \
  python -m json.tool 2>/dev/null || \
  cat

echo ""
echo "=" | tr -d '\n' | head -c 50
echo ""
echo "Mengambil data Production Log..."
echo "=" | tr -d '\n' | head -c 50
echo ""

curl -s "${HEADERS[@]}" \
  "${BASE_URL}/api/data/production-log?limit=10&status=start" | \
  python3 -m json.tool 2>/dev/null || \
  python -m json.tool 2>/dev/null || \
  cat

echo ""
echo "✅ Selesai!"


