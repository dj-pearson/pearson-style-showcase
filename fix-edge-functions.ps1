#!/usr/bin/env pwsh
# Fix all edge functions to use export default instead of serve()

$functionsDir = "danpearson-edge-functions\functions"
$functionDirs = Get-ChildItem -Path $functionsDir -Directory

Write-Host "Found $($functionDirs.Count) functions to fix..." -ForegroundColor Cyan

foreach ($dir in $functionDirs) {
    $indexPath = Join-Path $dir.FullName "index.ts"
    
    if (Test-Path $indexPath) {
        Write-Host "Fixing: $($dir.Name)..." -ForegroundColor Yellow
        
        $content = Get-Content $indexPath -Raw
        
        # Skip if already fixed (has 'export default')
        if ($content -match 'export default async') {
            Write-Host "  Already fixed - skipping" -ForegroundColor Green
            continue
        }
        
        # Remove serve import line
        $content = $content -replace 'import \{ serve \} from [^\r\n]+[\r\n]+', ''
        
        # Replace serve(async (req) => { with export default async (req: Request): Promise<Response> => {
        $content = $content -replace 'serve\(async \(req\) => \{', 'export default async (req: Request): Promise<Response> => {'
        
        # Replace serve( (async (req) => { with proper export (handle parentheses variations)
        $content = $content -replace 'serve\(\s*async \(req\) => \{', 'export default async (req: Request): Promise<Response> => {'
        
        # Replace closing }); with };
        # Find the last occurrence of });
        $lastIndex = $content.LastIndexOf('});')
        if ($lastIndex -ge 0) {
            $content = $content.Substring(0, $lastIndex) + '};' + $content.Substring($lastIndex + 3)
        }
        
        # Write back
        Set-Content $indexPath -Value $content -NoNewline
        
        Write-Host "  Fixed!" -ForegroundColor Green
    }
}

Write-Host "`nAll functions fixed! Ready to commit and deploy." -ForegroundColor Green
