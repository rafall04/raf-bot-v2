@echo off
title RAF-BOT Auto-Commit Service
color 0A

echo ================================================
echo        RAF-BOT v2 Auto-Commit Service
echo ================================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js first
    pause
    exit /b 1
)

:: Check if npm packages are installed
if not exist "node_modules\chokidar" (
    echo Installing required packages...
    npm install
    echo.
)

echo Starting auto-commit service...
echo This will monitor file changes and auto-commit to GitHub
echo.
echo Press Ctrl+C to stop the service
echo ------------------------------------------------
echo.

:: Run the auto-commit script
npm run auto-commit

pause
