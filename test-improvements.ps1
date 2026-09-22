# İyileştirmeleri test etmek için PowerShell script

$BASE_URL = "http://localhost:3000"

Write-Host "=== Performans ve Kod Kalitesi Testleri ===" -ForegroundColor Green

# Test 1: Cache Headers
Write-Host "`n1. Cache Headers Test (/api/events)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/events" -Method Head -MaximumRedirection 0 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 308) {
        # Redirect'i takip et
        $response = Invoke-WebRequest -Uri "$BASE_URL/api/events" -Method Head
    }
    $cacheControl = $response.Headers["Cache-Control"]
    $cdnCacheControl = $response.Headers["CDN-Cache-Control"]
    Write-Host "Cache-Control: $cacheControl"
    Write-Host "CDN-Cache-Control: $cdnCacheControl"
} catch {
    Write-Host "Hata: $_" -ForegroundColor Red
}

# Test 2: Pagination
Write-Host "`n2. Pagination Test (/api/admin/users)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/admin/users?page=1&perPage=5" -Method Get -MaximumRedirection 10
    Write-Host "Users returned: $($response.users.Count)"
} catch {
    Write-Host "Hata: $_" -ForegroundColor Red
}

# Test 3: Rate Limit Headers
Write-Host "`n3. Rate Limit Headers Test (/api/translate)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/translate" -Method Post -Body '{"text":"hello","target":"tr"}' -ContentType "application/json" -MaximumRedirection 10
    Write-Host "Translation successful: $($response.translatedText)"
} catch {
    Write-Host "Hata: $_" -ForegroundColor Red
}

Write-Host "`n=== Test Tamamlandı ===" -ForegroundColor Green