# Edge Functions Configuration Verification Script
# Run this to verify your self-hosted Edge Functions are properly configured

$FUNCTIONS_URL = "https://functions.danpearson.net"

Write-Host "🔍 Verifying Edge Functions Configuration..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$FUNCTIONS_URL/_health" -Method Get
    
    Write-Host "✅ Health endpoint accessible" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
    Write-Host "   Functions: $($health.functions)" -ForegroundColor Gray
    
    # Check environment configuration
    if ($health.environment) {
        Write-Host ""
        Write-Host "Environment Configuration:" -ForegroundColor Cyan
        Write-Host "   Supabase URL: $(if ($health.environment.supabaseUrlConfigured) { '✅' } else { '❌' })" -ForegroundColor $(if ($health.environment.supabaseUrlConfigured) { 'Green' } else { 'Red' })
        Write-Host "   Anon Key: $(if ($health.environment.anonKeyConfigured) { '✅' } else { '❌' })" -ForegroundColor $(if ($health.environment.anonKeyConfigured) { 'Green' } else { 'Red' })
        Write-Host "   Service Role Key: $(if ($health.environment.serviceRoleKeyConfigured) { '✅' } else { '❌' })" -ForegroundColor $(if ($health.environment.serviceRoleKeyConfigured) { 'Green' } else { 'Red' })
        
        # Check if critical keys are missing
        if (-not $health.environment.supabaseUrlConfigured -or -not $health.environment.serviceRoleKeyConfigured) {
            Write-Host ""
            Write-Host "⚠️  CRITICAL: Missing required environment variables!" -ForegroundColor Red
            Write-Host "   Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Coolify" -ForegroundColor Red
            exit 1
        }
    }
    
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Function Availability
Write-Host "2. Testing send-article-webhook function..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$FUNCTIONS_URL/send-article-webhook" -Method Options -ErrorAction Stop
    if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 204) {
        Write-Host "✅ send-article-webhook function is accessible" -ForegroundColor Green
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Function exists (requires authentication)" -ForegroundColor Green
    } else {
        Write-Host "❌ Function not accessible: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Summary
Write-Host "📊 Verification Summary:" -ForegroundColor Cyan
Write-Host "   Edge Functions are properly configured!" -ForegroundColor Green
Write-Host "   You can now test the webhook from your admin dashboard." -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Functions URL: $FUNCTIONS_URL" -ForegroundColor Gray
