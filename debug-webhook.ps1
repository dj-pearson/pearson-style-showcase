# Debug Webhook 500 Error
# This script helps diagnose the actual error

Write-Host "🔍 Debugging Webhook Error..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if we can reach the function
Write-Host "1. Testing function endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://functions.danpearson.net/send-article-webhook" `
        -Method Options `
        -ErrorAction Stop
    Write-Host "✅ Function endpoint reachable" -ForegroundColor Green
} catch {
    Write-Host "❌ Function endpoint error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Step 2: Test with actual request (will fail without auth, but should show different error)
Write-Host "2. Testing POST request..." -ForegroundColor Yellow
try {
    $body = @{
        isTest = $true
    } | ConvertTo-Json

    $headers = @{
        'Content-Type' = 'application/json'
    }

    $response = Invoke-RestMethod -Uri "https://functions.danpearson.net/send-article-webhook" `
        -Method Post `
        -Body $body `
        -Headers $headers `
        -ErrorAction Stop

    Write-Host "✅ Webhook test succeeded!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Gray

} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status Code: $statusCode" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Error Details:" -ForegroundColor Yellow
        $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host $errorObj.error -ForegroundColor Red
    } else {
        Write-Host "Raw Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Check Coolify logs for the edge-functions service" -ForegroundColor White
Write-Host "2. Look for the actual error message in the logs" -ForegroundColor White
Write-Host "3. The error will tell us if it's:" -ForegroundColor White
Write-Host "   - Database connection issue" -ForegroundColor Gray
Write-Host "   - RLS policy blocking" -ForegroundColor Gray
Write-Host "   - Missing environment variables" -ForegroundColor Gray
Write-Host "   - Webhook URL issue" -ForegroundColor Gray
