@echo off
title Titan Desktop App
cd /d "%~dp0"

echo.
echo  ============================================
echo   TITAN DESKTOP APP - Quick Start
echo  ============================================
echo.
echo  This launches ONLY the desktop app.
echo  Make sure the Titan Server is running elsewhere.
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed. Install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo  Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

REM Check if packages are built
if not exist "packages\shared\dist" (
    echo  Building packages...
    call npm run build
    if %errorlevel% neq 0 (
        echo  [ERROR] Build failed.
        pause
        exit /b 1
    )
)

echo  Launching Desktop App...
echo.
echo  ============================================
echo   The app window will appear shortly.
echo   Enter your server URL and login.
echo  ============================================
echo.

call npm run dev:desktop

pause
