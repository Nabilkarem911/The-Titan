@echo off
title Titan Desktop Agent - Setup

echo.
echo  ============================================
echo   TITAN DESKTOP AGENT - Setup and Launch
echo  ============================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed. Install Node.js 18+ first.
    pause
    exit /b 1
)
echo  [OK] Node.js found.

REM Check Docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo  [WARNING] Docker not found. Make sure PostgreSQL is running manually.
    goto :install
)

echo  [1/5] Starting Docker containers...
docker compose up -d 2>nul
if %errorlevel% neq 0 (
    echo  [WARNING] Docker compose failed. Is docker-compose.yml present?
) else (
    echo         Done.
)

:install
echo  [2/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo  [ERROR] npm install failed.
    pause
    exit /b 1
)
echo         Done.

echo  [3/5] Building all packages...
call npm run build
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed. Check errors above.
    pause
    exit /b 1
)
echo         Done.

echo  [4/5] Running database migrations...
call npm run db:migrate
if %errorlevel% neq 0 (
    echo  [WARNING] Migration failed. Database might already be up to date.
) else (
    echo         Done.
)

echo  [5/5] Starting services...
echo.
echo  ============================================
echo   Server:    http://localhost:3000
echo   Dashboard: http://localhost:5173
echo   Desktop:   Electron window will appear
echo  ============================================
echo.

REM Start server in a new window
start "Titan Server" cmd /k "npm run start:core"

echo  Waiting for server to start...
timeout /t 5 /nobreak >nul

REM Start dashboard in a new window
start "Titan Dashboard" cmd /k "npm run dev:dashboard"

echo  Waiting for dashboard...
timeout /t 3 /nobreak >nul

REM Start desktop app in a new window
echo  Launching Desktop App...
start "Titan Desktop" cmd /k "npm run dev:desktop"

echo.
echo  ============================================
echo   All services started!
echo  ============================================
echo   - Server:    http://localhost:3000
echo   - Dashboard: http://localhost:5173
echo   - Desktop:   Electron window should appear
echo  ============================================
echo.
echo  Close this window when done.
echo  Services run in their own windows.
echo.
pause
