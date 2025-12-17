# Setup Frontend Environment Variables
# Run this script to create .env.local with self-hosted Supabase configuration

Write-Host "======================================" -ForegroundColor Blue
Write-Host "danpearson.net Frontend Setup" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

$EnvFile = ".env.local"

# Check if .env.local already exists
if (Test-Path $EnvFile) {
    Write-Host "Warning: .env.local already exists" -ForegroundColor Yellow
    $Overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($Overwrite -ne "y" -and $Overwrite -ne "Y") {
        Write-Host "Aborting" -ForegroundColor Red
        exit 1
    }
}

# Create .env.local with self-hosted configuration
$EnvContent = @"
# danpearson.net Self-Hosted Supabase Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Self-Hosted Supabase API
VITE_SUPABASE_URL=https://api.danpearson.net
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NjAwMTU0MCwiZXhwIjo0OTIxNjc1MTQwLCJyb2xlIjoiYW5vbiJ9.smyKT5KYiVNCQLTvQR-r1V3auuuxr7eQznTYzSCThUY

# Edge Functions
VITE_FUNCTIONS_URL=https://functions.danpearson.net

# Optional: For local development, uncomment these:
# VITE_SUPABASE_URL=http://localhost:54321
# VITE_FUNCTIONS_URL=http://localhost:8000
"@

# Write to file
$EnvContent | Out-File -FilePath $EnvFile -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host ".env.local created successfully!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  VITE_SUPABASE_URL=https://api.danpearson.net" -ForegroundColor White
Write-Host "  VITE_FUNCTIONS_URL=https://functions.danpearson.net" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review .env.local to ensure values are correct" -ForegroundColor White
Write-Host "2. Test locally: npm run dev" -ForegroundColor White
Write-Host "3. Update Cloudflare Pages environment variables for production" -ForegroundColor White
Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
