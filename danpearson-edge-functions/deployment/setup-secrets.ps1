# PowerShell script to set up environment secrets for danpearson.net Edge Functions
# Usage: .\setup-secrets.ps1 [environment]
# Example: .\setup-secrets.ps1 production

param(
    [string]$Environment = "production"
)

Write-Host "======================================" -ForegroundColor Blue
Write-Host "danpearson.net Edge Functions" -ForegroundColor Blue
Write-Host "Environment Secrets Setup" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host "Environment: $Environment" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ProjectRoot ".env.$Environment"

# Check if .env file already exists
if (Test-Path $EnvFile) {
    Write-Host "⚠ Environment file already exists: $EnvFile" -ForegroundColor Yellow
    $Overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($Overwrite -ne "y" -and $Overwrite -ne "Y") {
        Write-Host "✗ Aborting" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Blue
Write-Host "Supabase Configuration" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

# Get Supabase URL
Write-Host "Enter your Supabase URL:" -ForegroundColor Cyan
Write-Host "  Production: https://api.danpearson.net" -ForegroundColor Gray
Write-Host "  Staging: https://staging-api.danpearson.net" -ForegroundColor Gray
Write-Host "  Local: http://localhost:54321" -ForegroundColor Gray
$SupabaseUrl = Read-Host "SUPABASE_URL"

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
    Write-Host "✗ SUPABASE_URL is required" -ForegroundColor Red
    exit 1
}

# Get Supabase Anon Key
Write-Host ""
Write-Host "Enter your Supabase Anonymous (Public) Key:" -ForegroundColor Cyan
Write-Host "  Find in: Supabase Dashboard → Settings → API → anon (public)" -ForegroundColor Gray
$SupabaseAnonKey = Read-Host "SUPABASE_ANON_KEY"

if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
    Write-Host "✗ SUPABASE_ANON_KEY is required" -ForegroundColor Red
    exit 1
}

# Get Supabase Service Role Key
Write-Host ""
Write-Host "Enter your Supabase Service Role (Admin) Key:" -ForegroundColor Cyan
Write-Host "  Find in: Supabase Dashboard → Settings → API → service_role" -ForegroundColor Gray
Write-Host "  ⚠ KEEP THIS SECRET - Has full database access!" -ForegroundColor Yellow
$SupabaseServiceRoleKey = Read-Host "SUPABASE_SERVICE_ROLE_KEY"

if ([string]::IsNullOrWhiteSpace($SupabaseServiceRoleKey)) {
    Write-Host "✗ SUPABASE_SERVICE_ROLE_KEY is required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Blue
Write-Host "Server Configuration" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

# Get Port
$Port = Read-Host "Server port (default: 8000)"
if ([string]::IsNullOrWhiteSpace($Port)) {
    $Port = "8000"
}

# Get Domain
$Domain = Read-Host "Domain (default: functions.danpearson.net)"
if ([string]::IsNullOrWhiteSpace($Domain)) {
    $Domain = "functions.danpearson.net"
}

# Get API Gateway URL
$ApiGatewayUrl = Read-Host "API Gateway URL (default: https://api.danpearson.net)"
if ([string]::IsNullOrWhiteSpace($ApiGatewayUrl)) {
    $ApiGatewayUrl = "https://api.danpearson.net"
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Blue
Write-Host "Optional Configuration" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

# Coolify Webhook URL
Write-Host "Enter Coolify webhook URL (optional, press Enter to skip):" -ForegroundColor Cyan
Write-Host "  Find in: Coolify → Your Service → Webhooks" -ForegroundColor Gray
$CoolifyWebhookUrl = Read-Host "COOLIFY_WEBHOOK_URL"

# Create .env file content
$EnvContent = @"
# danpearson.net Edge Functions Configuration
# Environment: $Environment
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# ============================================
# Self-Hosted Supabase Instance Configuration
# ============================================

# Your self-hosted Supabase instance URL
SUPABASE_URL=$SupabaseUrl

# Supabase Anonymous (Public) Key
SUPABASE_ANON_KEY=$SupabaseAnonKey

# Supabase Service Role (Admin) Key
# ⚠️ KEEP THIS SECRET - Has admin access to your database
SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceRoleKey

# ============================================
# Edge Functions Server Configuration
# ============================================

# Server port
PORT=$Port

# Domain configuration
DOMAIN=$Domain
API_GATEWAY_URL=$ApiGatewayUrl

# Deno Configuration
DENO_DIR=/app/.deno_cache

# ============================================
# Deployment Configuration (Optional)
# ============================================

"@

if (-not [string]::IsNullOrWhiteSpace($CoolifyWebhookUrl)) {
    $EnvContent += @"
# Coolify webhook URL for automated deployments
COOLIFY_WEBHOOK_URL=$CoolifyWebhookUrl

"@
}

# Write to file
$EnvContent | Out-File -FilePath $EnvFile -Encoding UTF8

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "✓ Environment file created successfully!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "File location: $EnvFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review the .env file to ensure all values are correct" -ForegroundColor White
Write-Host "2. Copy these values to Coolify environment variables" -ForegroundColor White
Write-Host "3. Deploy using: .\deployment\deploy-coolify.sh $Environment" -ForegroundColor White
Write-Host ""
Write-Host "Security reminders:" -ForegroundColor Yellow
Write-Host "- Never commit .env files to git" -ForegroundColor White
Write-Host "- Use Coolify's environment secrets feature" -ForegroundColor White
Write-Host "- Rotate keys regularly" -ForegroundColor White
Write-Host "- Use different keys for dev/staging/production" -ForegroundColor White
Write-Host ""

# Offer to copy to clipboard (if available)
if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
    $CopyToClipboard = Read-Host "Copy configuration to clipboard for Coolify? (y/N)"
    if ($CopyToClipboard -eq "y" -or $CopyToClipboard -eq "Y") {
        $EnvContent | Set-Clipboard
        Write-Host "✓ Configuration copied to clipboard!" -ForegroundColor Green
        Write-Host "Paste this into Coolify → Your Service → Environment" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "Done! 🎉" -ForegroundColor Green
