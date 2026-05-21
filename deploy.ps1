#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy claude-sync CLI to comet over SSH.
  Copies source files, builds on the server, installs the binary globally.
  - Passwordless SSH must be configured: addy@192.168.70.40 via ed25519 key
  - Node.js 18+ must be on comet (already installed for claw-code-agent)
  - install.sh handles: npm run build + npm link / ~/.local/bin symlink
  - API URL set in install.sh: http://192.168.70.40:3001
#>

# --- CONFIG -------------------------------------------------------------------
$SSH_USER    = "addy"
$SSH_HOST    = "192.168.70.40"
$SSH_PORT    = 22
$DEPLOY_PATH = "/home/addy/claude-sync-cli"
# ------------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot

function Write-Step([string]$msg) { Write-Host "`n=> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "   ok  $msg" -ForegroundColor Green }
function Write-Note([string]$msg) { Write-Host "   ..  $msg" -ForegroundColor Yellow }
function Write-Fail([string]$msg) { Write-Host "`n   ERROR: $msg" -ForegroundColor Red; exit 1 }

$Target = "${SSH_USER}@${SSH_HOST}"

function Invoke-Remote([string]$Cmd) {
    & ssh -p $SSH_PORT $Target $Cmd
    if ($LASTEXITCODE -ne 0) { Write-Fail "Remote command failed: $Cmd" }
}

function Invoke-Scp([string]$Local, [string]$Remote) {
    & scp -P $SSH_PORT -r $Local "${Target}:${Remote}"
    if ($LASTEXITCODE -ne 0) { Write-Fail "SCP failed: $Local" }
}

# 1. Test SSH
Write-Step "Testing SSH connection to $Target"
$ping = & ssh -p $SSH_PORT -o ConnectTimeout=5 -o BatchMode=yes $Target 'echo ok' 2>&1
if ($ping -ne 'ok') { Write-Fail "Cannot reach $Target. Check that comet is online and SSH key is loaded." }
Write-Ok "Connected"

# 2. Check Node.js
Write-Step "Checking Node.js on comet"
$nodeVer = & ssh -p $SSH_PORT $Target 'node --version 2>/dev/null || echo MISSING' 2>&1
if ($nodeVer.Trim() -eq 'MISSING') { Write-Fail "Node.js not found on comet. Install Node.js 18+ first." }
Write-Ok "Node.js $($nodeVer.Trim())"

# 3. Prepare deploy directory (home dir -- no sudo needed)
Write-Step "Creating $DEPLOY_PATH on comet"
Invoke-Remote "mkdir -p $DEPLOY_PATH"
Write-Ok "Directory ready"

# 4. Copy source files
Write-Step "Copying CLI source files"
$items = @("src","package.json","package-lock.json","tsconfig.json","tsup.config.ts","install.sh")
foreach ($item in $items) {
    $local = Join-Path $Root $item
    if (Test-Path $local) {
        Invoke-Scp $local "$DEPLOY_PATH/"
        Write-Ok $item
    } else {
        Write-Note "Skipping $item (not found)"
    }
}

# 5. Install npm dependencies
Write-Step "Installing npm dependencies on comet"
Invoke-Remote "cd $DEPLOY_PATH; npm install"
Write-Ok "Dependencies installed"

# 6. Build and install binary
Write-Step "Building and installing claude-sync binary"
Invoke-Remote "cd $DEPLOY_PATH; chmod +x install.sh; bash install.sh"
Write-Ok "Binary installed"

# 7. Verify
Write-Step "Verifying install"
$ver = & ssh -p $SSH_PORT $Target 'claude-sync --version 2>/dev/null || ~/.local/bin/claude-sync --version 2>/dev/null || echo FAIL' 2>&1
if ($ver -match 'FAIL') {
    Write-Note "Binary not on PATH yet -- on comet run: source ~/.bashrc"
} else {
    Write-Ok "claude-sync $($ver.Trim()) is live on comet"
}

Write-Host ""
Write-Host "  On comet:   claude-sync --help" -ForegroundColor White
Write-Host "  API target: http://${SSH_HOST}:3001" -ForegroundColor DarkGray
Write-Host "  SSH in:     ssh $Target" -ForegroundColor DarkGray
