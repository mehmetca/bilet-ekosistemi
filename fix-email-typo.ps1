# PowerShell Script to Fix Email Validation Typo
# This script fixes the buyER_email typo in actions.ts

# Read the file content
$content = Get-Content -Path "C:\bilet-ekosistemi\src\app\etkinlik\[id]\actions.ts" -Raw

# Replace the typo
$fixedContent = $content -replace 'buyER_email', 'buyerEmail'

# Write back to file
Set-Content -Path "C:\bilet-ekosistemi\src\app\etkinlik\[id]\actions.ts" -Value $fixedContent -Force

Write-Host "Email validation typo fixed successfully!"
