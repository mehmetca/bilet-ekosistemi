#!/bin/bash

# İyileştirmeleri test etmek için basit script

echo "=== Performans ve Kod Kalitesi Testleri ==="

# Test URL'ler (development için)
BASE_URL="http://localhost:3000"

echo "1. Cache Headers Test (/api/events)"
curl -I "$BASE_URL/api/events" 2>/dev/null | grep -E "(Cache-Control|CDN-Cache-Control)"

echo -e "\n2. Pagination Test (/api/admin/users)"
curl -s "$BASE_URL/api/admin/users?page=1&perPage=5" | head -c 200

echo -e "\n3. Validation Test (Invalid Email)"
curl -s -X POST "$BASE_URL/api/admin/users" \
  -H "Content-Type: application/json" \
  -d '{"action":"add","email":"invalid","role":"admin"}' | head -c 200

echo -e "\n4. Rate Limit Test (Translate API - First Request)"
curl -s -X POST "$BASE_URL/api/translate" \
  -H "Content-Type: application/json" \
  -d '{"text":"hello","target":"tr"}' \
  -w "\nRate Limit Headers: %{header_json}\n" | head -c 100

echo -e "\n=== Test Tamamlandı ==="