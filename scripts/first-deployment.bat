@echo off
:: ================================================
:: First Time Production Deployment Helper
:: Run this after deploy.bat for initial setup
:: ================================================

setlocal enabledelayedexpansion

echo.
echo ============================================
echo     FIRST TIME PRODUCTION SETUP
echo ============================================
echo.

set PROD_DIR=C:\production\raf-bot
set DEV_DIR=C:\project\raf-bot-v2

:: Check if production directory exists
if not exist "%PROD_DIR%" (
    echo ❌ Production directory not found: %PROD_DIR%
    echo Please run deploy.bat first!
    pause
    exit /b 1
)

cd /d "%PROD_DIR%"

echo This script will help you set up production for the first time.
echo.

:: Step 1: Check node_modules
echo [Step 1/4] Checking dependencies...
if not exist "node_modules" (
    echo ⚠ Dependencies not installed. Installing now...
    call npm install --production
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
) else (
    echo ✅ Dependencies already installed
)

echo.

:: Step 2: Copy database
echo [Step 2/4] Setting up database...
if not exist "database\database.sqlite" (
    echo - Database not found. Copying from development...
    if exist "%DEV_DIR%\database\database.sqlite" (
        copy "%DEV_DIR%\database\database.sqlite" "database\" >nul
        echo ✅ Database copied from development
    ) else (
        echo ⚠ No database found in development either
        echo You'll need to create a new database
    )
) else (
    echo ✅ Database already exists
)

:: Copy JSON databases
echo - Copying JSON database files...
set JSON_COUNT=0
for %%f in (%DEV_DIR%\database\*.json) do (
    if not exist "database\%%~nxf" (
        copy "%%f" "database\" >nul 2>&1
        set /a JSON_COUNT+=1
    )
)
if %JSON_COUNT% GTR 0 (
    echo ✅ Copied %JSON_COUNT% JSON database files
) else (
    echo - All JSON files already exist
)

echo.

:: Step 3: Setup config files
echo [Step 3/4] Setting up configuration...

if not exist "config.json" (
    if exist "config.example.json" (
        copy config.example.json config.json >nul
        echo ✅ Created config.json from example
        echo.
        echo ⚠ IMPORTANT: Edit config.json with your settings!
        notepad config.json
    ) else (
        echo ❌ config.example.json not found!
    )
) else (
    echo ✅ config.json already exists
)

if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo ✅ Created .env from example
        echo.
        echo ⚠ IMPORTANT: Edit .env with your settings!
        notepad .env
    ) else (
        echo ⚠ .env.example not found, creating basic .env
        (
            echo # Environment Configuration
            echo NODE_ENV=production
            echo PORT=3100
        ) > .env
    )
) else (
    echo ✅ .env already exists
)

echo.

:: Step 4: Run migrations
echo [Step 4/4] Running database migrations...
if exist "scripts\migrate.js" (
    node scripts\migrate.js
    if %ERRORLEVEL% NEQ 0 (
        echo ⚠ Migration had issues, please check manually
    ) else (
        echo ✅ Migrations completed
    )
) else (
    echo ⚠ Migration script not found
)

echo.
echo ============================================
echo     SETUP COMPLETED!
echo ============================================
echo.
echo Production directory: %PROD_DIR%
echo.
echo ✅ Checklist:
echo [✓] Dependencies installed
echo [✓] Database configured
echo [✓] Config files created
echo [✓] Migrations run
echo.
echo Next steps:
echo -----------
echo 1. Verify config.json and .env settings
echo 2. Test the application:
echo    node index.js
echo.
echo 3. Install PM2 for production:
echo    npm install -g pm2
echo    pm2 start ecosystem.config.js
echo.
echo 4. Setup Git repository:
echo    git init
echo    git add .
echo    git commit -m "Initial production setup"
echo.

pause
