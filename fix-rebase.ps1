# Fix Git Rebase - Run this AFTER closing accounting_documents_rows.csv
# (Close Excel, Cursor tab, or any app that has the file open)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Step 1: Removing accounting_documents_rows.csv..." -ForegroundColor Cyan
if (Test-Path accounting_documents_rows.csv) {
    Remove-Item accounting_documents_rows.csv -Force
    Write-Host "  File removed." -ForegroundColor Green
} else {
    Write-Host "  File already gone." -ForegroundColor Green
}

Write-Host "`nStep 2: Amending staged .gitignore into commit, then continuing rebase..." -ForegroundColor Cyan
git commit --amend --no-edit
git rebase --continue

Write-Host "`nStep 3: Removing CSV from the commit (it was added by mistake)..." -ForegroundColor Cyan
git rm --cached accounting_documents_rows.csv 2>$null
if ($LASTEXITCODE -eq 0) {
    git add .gitignore
    git commit --amend --no-edit
}

Write-Host "`nDone! You can now push to GitHub." -ForegroundColor Green
