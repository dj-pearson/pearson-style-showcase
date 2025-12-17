# Migrate all supabase.functions.invoke() to invokeEdgeFunction()

$filesUpdated = 0
$callsReplaced = 0

Write-Host "Starting edge function migration..." -ForegroundColor Cyan
Write-Host ""

# Get all TypeScript/TSX files in src directory
$files = Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | Where-Object {
    $_.FullName -notmatch "node_modules" -and
    $_.FullName -notmatch ".test." -and
    $_.FullName -notmatch ".spec."
}

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Skip if no supabase.functions.invoke calls
    if ($content -notmatch "supabase\.functions\.invoke\(") {
        continue
    }
    
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
    Write-Host "Processing: $relativePath" -ForegroundColor Yellow
    
    # Count occurrences before replacement
    $matches = [regex]::Matches($content, "supabase\.functions\.invoke\(")
    $count = $matches.Count
    $callsReplaced += $count
    
    # Add import if not present
    if ($content -notmatch "import.*invokeEdgeFunction") {
        # Find the last import statement
        $lastImportMatch = [regex]::Matches($content, "import[^;]+;")
        if ($lastImportMatch.Count -gt 0) {
            $lastImport = $lastImportMatch[$lastImportMatch.Count - 1]
            $insertPosition = $lastImport.Index + $lastImport.Length
            
            # Insert new import after last import
            $newImport = "`nimport { invokeEdgeFunction } from '@/lib/edge-functions';"
            $content = $content.Insert($insertPosition, $newImport)
            
            Write-Host "  Added import statement" -ForegroundColor Green
        }
    } else {
        Write-Host "  Import already exists" -ForegroundColor Gray
    }
    
    # Replace all supabase.functions.invoke with invokeEdgeFunction
    $content = $content -replace "supabase\.functions\.invoke\(", "invokeEdgeFunction("
    
    Write-Host "  Replaced $count function call(s)" -ForegroundColor Green
    
    # Only write if content changed
    if ($content -ne $originalContent) {
        Set-Content $file.FullName -Value $content -NoNewline
        $filesUpdated++
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Files updated: $filesUpdated" -ForegroundColor White
Write-Host "Function calls replaced: $callsReplaced" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review changes: git diff" -ForegroundColor White
Write-Host "2. Test locally: npm run dev" -ForegroundColor White
Write-Host "3. Commit and push changes" -ForegroundColor White
