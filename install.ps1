# install.ps1 — build and globally install claude-sync from local source

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$COMET_API = 'http://192.168.70.40:4000'

Write-Host "Building claude-sync..." -ForegroundColor Cyan
npm run build
if (-not $?) { Write-Error "Build failed"; exit 1 }

Write-Host "Installing globally..." -ForegroundColor Cyan
npm install -g .
if (-not $?) { Write-Error "Global install failed"; exit 1 }

# Write starter config pointing at comet if none exists yet
$configDir  = "$env:USERPROFILE\.claude-sync"
$configFile = "$configDir\config.json"
if (-not (Test-Path $configFile)) {
    New-Item -ItemType Directory -Force $configDir | Out-Null
    [System.IO.File]::WriteAllText($configFile, "{`"api_url`":`"$COMET_API`"}`n")
    Write-Host "Config created: api_url → $COMET_API" -ForegroundColor Green
} else {
    Write-Host "Existing config kept ($configFile)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Done. Run 'claude-sync --help' to get started." -ForegroundColor Green
