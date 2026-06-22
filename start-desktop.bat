@echo off
setlocal enabledelayedexpansion

echo.
echo  ============================================
echo   TITAN DESKTOP AGENT - Setup ^& Launch
echo  ============================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo  [ERROR] Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if Docker is running (for PostgreSQL)
where docker >nul 2>&1
if !errorlevel! neq 0 (
    echo  [WARNING] Docker not found. Make sure PostgreSQL is running manually.
) else (
    echo  [1/5] Starting Docker containers (PostgreSQL)...
    docker compose up -d 2>nul
    if !errorlevel! neq 0 (
        echo  [WARNING] Docker compose failed. Is docker-compose.yml present?
    ) else (
        echo         Done.
    )
)

echo  [2/5] Installing dependencies...
call npm install
if !errorlevel! neq 0 (
    echo  [ERROR] npm install failed.
    pause
    exit /b 1
)
echo         Done.

echo  [3/5] Building all packages...
call npm run build
if !errorlevel! neq 0 (
    echo  [ERROR] Build failed. Check errors above.
    pause
    exit /b 1
)
echo         Done.

echo  [4/5] Running database migrations...
call npm run db:migrate
if !errorlevel! neq 0 (
    echo  [WARNING] Migration failed. Database might already be up to date.
) else (
    echo         Done.
)

echo  [5/5] Starting Titan Server...
echo.
echo  ============================================
echo   Server is starting on http://localhost:3000
echo   Dashboard: http://localhost:5173
echo   Desktop App will launch automatically
echo  ============================================
echo.

REM Start server in background
start "Titan Server" cmd /k "npm run start:core"

REM Wait for server to be ready
echo  Waiting for server to start...
timeout /t 5 /nobreak >nul

REM Start dashboard in background
start "Titan Dashboard" cmd /k "npm run dev:dashboard"

REM Wait a bit
timeout /t 3 /nobreak >nul

REM Start desktop app
echo  Launching Desktop App...
start "Titan Desktop" cmd /k "npm run dev:desktop"

echo.
echo  All services started!
echo  - Server:   http://localhost:3000
echo  - Dashboard: http://localhost:5173
echo  - Desktop:  Electron window should appear
echo.
echo  Close this window when done. Services run in their own windows.
pause
