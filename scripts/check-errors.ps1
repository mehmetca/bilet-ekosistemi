# Hata kontrol scripti - PowerShell'de calistirin
# Kullanim: .\scripts\check-errors.ps1
# veya: powershell -ExecutionPolicy Bypass -File scripts\check-errors.ps1

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

Write-Host "=== HATA KONTROL ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "npm run check calistiriliyor (lint + build)..." -ForegroundColor Yellow
Write-Host ""

# cmd ile calistir - Sentry deprecation uyarilari stderr'e yazdigi icin PowerShell hata vermesin
cmd /c "npm run check"
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "=== TUM KONTROLLER BASARILI ===" -ForegroundColor Green
} else {
    Write-Host "=== HATA VAR - Yukaridaki ciktiyi inceleyin ===" -ForegroundColor Red
}
exit $exitCode
