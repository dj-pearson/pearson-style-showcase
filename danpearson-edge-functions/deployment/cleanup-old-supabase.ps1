# PowerShell script to clean up old Supabase cloud references
# Usage: .\cleanup-old-supabase.ps1 [-DryRun] [-Backup]
# 
# Searches for and replaces references to old cloud Supabase URLs with self-hosted URLs
# in your danpearson.net project

param(
    [switch]$DryRun = $false,
    [switch]$Backup = $true
)

Write-Host "======================================" -ForegroundColor Blue
Write-Host "Supabase URL Cleanup Script" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "Project root: $ProjectRoot" -ForegroundColor Cyan
Write-Host ""

# Old Supabase URL patterns to replace
$OldPatterns = @(
    "qazhdcqvjppbbjxzvisp.supabase.co",
    "https://qazhdcqvjppbbjxzvisp.supabase.co",
    "http://qazhdcqvjppbbjxzvisp.supabase.co"
)

# New self-hosted URLs
$NewApiUrl = "https://api.danpearson.net"
$NewFunctionsUrl = "https://functions.danpearson.net"

# File patterns to search
$FilePatterns = @(
    "*.ts",
    "*.tsx",
    "*.js",
    "*.jsx",
    "*.env*",
    "*.md",
    "*.json",
    "*.yaml",
    "*.yml"
)

# Directories to exclude
$ExcludeDirs = @(
    "node_modules",
    "dist",
    "build",
    ".git",
    ".next",
    "out",
    "coverage",
    ".deno_cache"
)

Write-Host "======================================" -ForegroundColor Blue
Write-Host "Step 1: Finding files to process" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

# Find all files matching patterns
$FilesToProcess = @()
foreach ($Pattern in $FilePatterns) {
    $Files = Get-ChildItem -Path $ProjectRoot -Recurse -Filter $Pattern -File -ErrorAction SilentlyContinue |
        Where-Object { 
            $Path = $_.FullName
            $ShouldExclude = $false
            foreach ($ExcludeDir in $ExcludeDirs) {
                if ($Path -like "*\$ExcludeDir\*" -or $Path -like "*/$ExcludeDir/*") {
                    $ShouldExclude = $true
                    break
                }
            }
            -not $ShouldExclude
        }
    $FilesToProcess += $Files
}

Write-Host "Found $($FilesToProcess.Count) files to scan" -ForegroundColor Cyan
Write-Host ""

if ($FilesToProcess.Count -eq 0) {
    Write-Host "✓ No files to process" -ForegroundColor Green
    exit 0
}

Write-Host "======================================" -ForegroundColor Blue
Write-Host "Step 2: Searching for old references" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

$FilesWithMatches = @()
$TotalMatches = 0

foreach ($File in $FilesToProcess) {
    $Content = Get-Content -Path $File.FullName -Raw -ErrorAction SilentlyContinue
    if ($null -eq $Content) { continue }
    
    $HasMatch = $false
    foreach ($Pattern in $OldPatterns) {
        if ($Content -match [regex]::Escape($Pattern)) {
            $HasMatch = $true
            $Matches = ([regex]::Matches($Content, [regex]::Escape($Pattern))).Count
            $TotalMatches += $Matches
            break
        }
    }
    
    if ($HasMatch) {
        $FilesWithMatches += $File
        $RelativePath = $File.FullName.Replace($ProjectRoot, "")
        Write-Host "  📄 $RelativePath" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Found $TotalMatches references in $($FilesWithMatches.Count) files" -ForegroundColor Cyan
Write-Host ""

if ($FilesWithMatches.Count -eq 0) {
    Write-Host "✓ No old Supabase references found!" -ForegroundColor Green
    exit 0
}

if ($DryRun) {
    Write-Host "======================================" -ForegroundColor Yellow
    Write-Host "DRY RUN - Files that would be modified:" -ForegroundColor Yellow
    Write-Host "======================================" -ForegroundColor Yellow
    foreach ($File in $FilesWithMatches) {
        $RelativePath = $File.FullName.Replace($ProjectRoot, "")
        Write-Host "  $RelativePath" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Run without -DryRun to make changes" -ForegroundColor Yellow
    exit 0
}

# Create backup if requested
if ($Backup) {
    Write-Host "======================================" -ForegroundColor Blue
    Write-Host "Step 3: Creating backup" -ForegroundColor Blue
    Write-Host "======================================" -ForegroundColor Blue
    Write-Host ""
    
    $BackupDir = Join-Path $ProjectRoot "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    
    foreach ($File in $FilesWithMatches) {
        $RelativePath = $File.FullName.Replace($ProjectRoot, "")
        $BackupPath = Join-Path $BackupDir $RelativePath
        $BackupParent = Split-Path -Parent $BackupPath
        
        if (!(Test-Path $BackupParent)) {
            New-Item -ItemType Directory -Path $BackupParent -Force | Out-Null
        }
        
        Copy-Item -Path $File.FullName -Destination $BackupPath -Force
    }
    
    Write-Host "✓ Backup created at: $BackupDir" -ForegroundColor Green
    Write-Host ""
}

Write-Host "======================================" -ForegroundColor Blue
Write-Host "Step 4: Replacing references" -ForegroundColor Blue
Write-Host "======================================" -ForegroundColor Blue
Write-Host ""

$FilesModified = 0

foreach ($File in $FilesWithMatches) {
    $Content = Get-Content -Path $File.FullName -Raw
    $OriginalContent = $Content
    
    # Replace old Supabase URLs with new API URL
    foreach ($Pattern in $OldPatterns) {
        $Content = $Content -replace [regex]::Escape($Pattern), $NewApiUrl.Replace("https://", "")
    }
    
    # Special handling for function invocations
    # Replace supabase.functions.invoke() with direct fetch() to functions.danpearson.net
    # This is a heuristic and might need manual review
    
    if ($Content -ne $OriginalContent) {
        Set-Content -Path $File.FullName -Value $Content -NoNewline
        $FilesModified++
        $RelativePath = $File.FullName.Replace($ProjectRoot, "")
        Write-Host "  ✓ Updated: $RelativePath" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "✓ Cleanup complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Files scanned: $($FilesToProcess.Count)" -ForegroundColor White
Write-Host "  Files with matches: $($FilesWithMatches.Count)" -ForegroundColor White
Write-Host "  Files modified: $FilesModified" -ForegroundColor White
Write-Host "  Total references replaced: $TotalMatches" -ForegroundColor White
Write-Host ""

if ($Backup) {
    Write-Host "Backup location: $BackupDir" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review the changes (git diff)" -ForegroundColor White
Write-Host "2. Test your application thoroughly" -ForegroundColor White
Write-Host "3. Update environment variables:" -ForegroundColor White
Write-Host "   VITE_SUPABASE_URL=https://api.danpearson.net" -ForegroundColor Gray
Write-Host "   VITE_SUPABASE_ANON_KEY=<your-new-anon-key>" -ForegroundColor Gray
Write-Host "4. Update edge function calls to use:" -ForegroundColor White
Write-Host "   $NewFunctionsUrl" -ForegroundColor Gray
Write-Host "5. Redeploy your frontend" -ForegroundColor White
Write-Host ""
Write-Host "⚠ Important:" -ForegroundColor Yellow
Write-Host "  Some edge function calls may need manual updates" -ForegroundColor White
Write-Host "  Search for: supabase.functions.invoke()" -ForegroundColor White
Write-Host "  Replace with: fetch('$NewFunctionsUrl/function-name')" -ForegroundColor White
Write-Host ""

# Offer to show git diff
$ShowDiff = Read-Host "Show git diff of changes? (y/N)"
if ($ShowDiff -eq "y" -or $ShowDiff -eq "Y") {
    git diff
}

Write-Host ""
Write-Host "Done! 🎉" -ForegroundColor Green
