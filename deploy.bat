@echo off
setlocal enabledelayedexpansion

REM ============================================
REM   RAF Bot V2 - Windows Deployment Script
REM ============================================

echo.
echo ============================================
echo    RAF Bot V2 - Deployment Script
echo ============================================
echo.

REM Configuration
set APP_NAME=raf-bot
set APP_DIR=%CD%
set BACKUP_DIR=%APP_DIR%\backups
set PM2_APP_NAME=raf-bot

REM Check if running in correct directory
if not exist "package.json" (
    echo [ERROR] Not in RAF Bot directory!
    echo Please run this script from the RAF Bot root directory.
    pause
    exit /b 1
)

REM Check requirements
echo [INFO] Checking requirements...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] NPM not found! Please install Node.js/NPM first.
    pause
    exit /b 1
)

where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] PM2 not found! Installing PM2 globally...
    npm install -g pm2
)

echo [OK] All requirements met
echo.

REM Parse command
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=deploy

if "%COMMAND%"=="deploy" goto :deploy
if "%COMMAND%"=="rollback" goto :rollback
if "%COMMAND%"=="restart" goto :restart
if "%COMMAND%"=="backup" goto :backup
if "%COMMAND%"=="health" goto :health
if "%COMMAND%"=="setup" goto :setup
goto :help

:deploy
echo [INFO] Starting deployment...
echo.

REM Create backup
call :create_backup

REM Pull latest code (if git repo exists)
if exist ".git" (
    echo [INFO] Pulling latest code...
    git fetch origin main
    git pull origin main
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to pull latest code, continuing anyway...
    ) else (
        echo [OK] Code updated
    )
) else (
    echo [INFO] No git repository found, skipping code update
)

REM Install dependencies
echo [INFO] Installing dependencies...
if exist "package-lock.json" (
    npm ci --production
) else (
    npm install --production
)
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Run migrations
if exist "tools\smart-migrate-database.js" (
    echo [INFO] Running database migrations...
    node tools\smart-migrate-database.js
    if %errorlevel% neq 0 (
        echo [WARNING] Migration had issues, check logs
    ) else (
        echo [OK] Database migrations completed
    )
) else if exist "migrate-database.bat" (
    echo [INFO] Running database migrations...
    call migrate-database.bat
)
echo.

REM Setup configuration files
call :setup_config

REM Restart application
call :restart_app

REM Health check
call :health_check

echo.
echo ============================================
echo    Deployment completed successfully!
echo ============================================
echo.
echo Useful commands:
echo   - View status: pm2 status
echo   - View logs: pm2 logs %PM2_APP_NAME%
echo   - Monitor: pm2 monit
echo   - Stop: pm2 stop %PM2_APP_NAME%
echo   - Restart: pm2 restart %PM2_APP_NAME%
echo.
pause
exit /b 0

:rollback
echo [INFO] Starting rollback...
echo.
echo Available backups:
dir /B /O-D "%BACKUP_DIR%\backup-*.zip" 2>nul | head -5
echo.
set /p BACKUP_FILE="Enter backup filename (or 'cancel'): "

if "%BACKUP_FILE%"=="cancel" (
    echo [INFO] Rollback cancelled
    pause
    exit /b 0
)

if not exist "%BACKUP_DIR%\%BACKUP_FILE%" (
    echo [ERROR] Backup file not found
    pause
    exit /b 1
)

REM Stop application
pm2 stop %PM2_APP_NAME% >nul 2>&1

REM Extract backup
echo [INFO] Restoring backup...
powershell -command "Expand-Archive -Path '%BACKUP_DIR%\%BACKUP_FILE%' -DestinationPath '%APP_DIR%' -Force"

if %errorlevel% equ 0 (
    echo [OK] Backup restored
    call :restart_app
    call :health_check
    echo [OK] Rollback completed
) else (
    echo [ERROR] Failed to restore backup
)
pause
exit /b %errorlevel%

:restart
call :restart_app
call :health_check
pause
exit /b 0

:backup
call :create_backup
pause
exit /b 0

:health
call :health_check
pause
exit /b 0

:setup
echo [INFO] Setting up production environment...
echo.

REM Copy configuration files
call :setup_config

REM Create necessary directories
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads
if not exist "temp" mkdir temp
if not exist "backups" mkdir backups
if not exist "session" mkdir session

echo.
echo [OK] Setup completed!
echo.
echo [IMPORTANT] Please edit the following files:
echo   1. config.json - Set your API keys, URLs, etc.
echo   2. .env - Set environment variables
echo   3. ecosystem.config.js - Adjust PM2 settings if needed
echo.
pause
exit /b 0

:help
echo Usage: %0 [command]
echo.
echo Commands:
echo   deploy   - Deploy latest version (default)
echo   rollback - Rollback to previous version
echo   restart  - Restart application
echo   backup   - Create backup only
echo   health   - Check application health
echo   setup    - Initial setup for production
echo.
pause
exit /b 0

REM ============ Helper Functions ============

:create_backup
echo [INFO] Creating backup...

if not exist "%APP_DIR%" (
    echo [WARNING] App directory doesn't exist, skipping backup
    exit /b 0
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

set BACKUP_NAME=backup-%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%.zip
set BACKUP_NAME=!BACKUP_NAME: =0!
set BACKUP_PATH=%BACKUP_DIR%\!BACKUP_NAME!

REM Create backup using PowerShell
powershell -command "Compress-Archive -Path '%APP_DIR%\*' -DestinationPath '!BACKUP_PATH!' -Force -CompressionLevel Optimal -Exclude @('node_modules','logs','temp','.git')"

if %errorlevel% equ 0 (
    echo [OK] Backup created: !BACKUP_NAME!
    
    REM Delete old backups (older than 30 days)
    forfiles /P "%BACKUP_DIR%" /M backup-*.zip /D -30 /C "cmd /c del @path" 2>nul
) else (
    echo [ERROR] Failed to create backup
    pause
    exit /b 1
)
exit /b 0

:setup_config
echo [INFO] Checking configuration...

REM Copy config.json if it doesn't exist
if not exist "config.json" (
    if exist "config.example.json" (
        copy config.example.json config.json >nul
        echo [WARNING] Created config.json from example - PLEASE EDIT IT!
    )
)

REM Copy .env if it doesn't exist
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [WARNING] Created .env from example - PLEASE EDIT IT!
    )
)

REM Copy PM2 ecosystem file if it doesn't exist
if not exist "ecosystem.config.js" (
    if exist "ecosystem.config.example.js" (
        copy ecosystem.config.example.js ecosystem.config.js >nul
        echo [OK] Created ecosystem.config.js
    )
)
exit /b 0

:restart_app
echo [INFO] Restarting application...

REM Check if app is already running
pm2 list | findstr /C:"%PM2_APP_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    REM Reload with 0-downtime
    pm2 reload %PM2_APP_NAME% --update-env
    echo [OK] Application reloaded
) else (
    REM Start fresh
    if exist "ecosystem.config.js" (
        pm2 start ecosystem.config.js
    ) else (
        pm2 start index.js --name %PM2_APP_NAME%
    )
    echo [OK] Application started
)

REM Save PM2 configuration
pm2 save >nul 2>&1
exit /b 0

:health_check
echo [INFO] Performing health check...

REM Wait for app to start
timeout /t 5 /nobreak >nul

REM Try to access health endpoint
curl -f -s -o nul http://localhost:3100/health 2>nul
if %errorlevel% equ 0 (
    echo [OK] Health check passed
) else (
    echo [WARNING] Health check failed - check application logs
    echo Run: pm2 logs %PM2_APP_NAME%
)
exit /b 0
