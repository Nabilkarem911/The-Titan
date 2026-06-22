# Titan Desktop Agent - Setup & Launch
# Run: Right-click -> Run with PowerShell
# Or:  powershell -ExecutionPolicy Bypass -File start-desktop.ps1

$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   TITAN DESKTOP AGENT - Setup & Launch" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] Node.js is not installed. Install Node.js 18+ first." -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  [OK] Node.js found." -ForegroundColor Green

# Check Docker (only needed if running server locally)
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "  [1/5] Starting Docker containers..." -ForegroundColor Yellow
    docker compose up -d 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "        Done." -ForegroundColor Green
    } else {
        Write-Host "        [WARNING] Docker compose failed." -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  [INFO] Docker not found. Skipping local DB setup." -ForegroundColor DarkGray
    Write-Host "         If the server is on another machine, this is fine." -ForegroundColor DarkGray
    Write-Host "         If running server locally, start PostgreSQL manually." -ForegroundColor DarkGray
}

# Install
Write-Host "  [2/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] npm install failed." -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "        Done." -ForegroundColor Green

# Build
Write-Host "  [3/5] Building all packages..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Build failed. Check errors above." -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "        Done." -ForegroundColor Green

# Migrate
Write-Host "  [4/5] Running database migrations..." -ForegroundColor Yellow
npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "        [WARNING] Migration failed. DB might already be up to date." -ForegroundColor DarkYellow
} else {
    Write-Host "        Done." -ForegroundColor Green
}

# Launch
Write-Host "  [5/5] Starting services..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   Server:    http://localhost:3000" -ForegroundColor White
Write-Host "   Dashboard: http://localhost:5173" -ForegroundColor White
Write-Host "   Desktop:   Electron window will appear" -ForegroundColor White
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

Start-Process -FilePath "cmd" -ArgumentList "/k", "npm run start:core" -WindowStyle Normal
Write-Host "  Waiting for server to start..." -ForegroundColor DarkGray
Start-Sleep -Seconds 5

Start-Process -FilePath "cmd" -ArgumentList "/k", "npm run dev:dashboard" -WindowStyle Normal
Write-Host "  Waiting for dashboard..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

Write-Host "  Launching Desktop App..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/k", "npm run dev:desktop" -WindowStyle Normal

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "   All services started!" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Close this window when done." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Press Enter to close"
