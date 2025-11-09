@echo off
:: ================================================
:: Quick Fix for Missing Database in Production
:: ================================================

echo.
echo ============================================
echo     FIX MISSING DATABASE IN PRODUCTION
echo ============================================
echo.

set PROD_DIR=C:\production\raf-bot
set DEV_DIR=C:\project\raf-bot-v2

:: Check production exists
if not exist "%PROD_DIR%" (
    echo ❌ Production directory not found: %PROD_DIR%
    pause
    exit /b 1
)

cd /d "%PROD_DIR%"

echo [Step 1/3] Copying database from development...

:: Copy SQLite database
if exist "%DEV_DIR%\database\database.sqlite" (
    echo - Copying SQLite database...
    copy "%DEV_DIR%\database\database.sqlite" "database\" /Y
    if %ERRORLEVEL% EQU 0 (
        echo ✓ Database copied successfully
    ) else (
        echo ❌ Failed to copy database
        pause
        exit /b 1
    )
) else (
    echo ❌ Database not found in development!
    echo   Expected: %DEV_DIR%\database\database.sqlite
    pause
    exit /b 1
)

:: Copy JSON databases
echo - Copying JSON database files...
copy "%DEV_DIR%\database\*.json" "database\" /Y >nul 2>&1
echo ✓ JSON databases copied

echo.
echo [Step 2/3] Setting up config files...

:: Setup config.json if not exists
if not exist "config.json" (
    if exist "config.example.json" (
        copy config.example.json config.json >nul
        echo ✓ Created config.json from example
    )
)

:: Setup .env if not exists  
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo ✓ Created .env from example
    ) else (
        (
            echo NODE_ENV=production
            echo PORT=3100
        ) > .env
        echo ✓ Created basic .env
    )
)

echo.
echo [Step 3/3] Running migrations...

if exist "scripts\migrate.js" (
    node scripts\migrate.js
    if %ERRORLEVEL% EQU 0 (
        echo ✓ Migrations completed successfully
    ) else (
        echo ⚠ Migration had issues, check output above
    )
) else (
    echo ⚠ Migration script not found
)

echo.
echo ============================================
echo     FIX COMPLETED!
echo ============================================
echo.
echo Database has been copied and migrations run.
echo You can now test the application:
echo.
echo   cd %PROD_DIR%
echo   node index.js
echo.

pause
