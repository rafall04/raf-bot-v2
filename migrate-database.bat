@echo off
echo.
echo ============================================
echo   RAF-BOT V2 - Database Migration Tool
echo ============================================
echo.
echo This tool will:
echo 1. Backup your current database to backups/ folder
echo 2. Detect missing columns
echo 3. Add any missing fields automatically
echo 4. Preserve all existing data
echo.
echo Press Ctrl+C to cancel or...
pause

echo.
echo Starting migration...
echo.

REM Try the new comprehensive migration script first
if exist scripts\migrate-database.js (
    echo Running comprehensive migration...
    node scripts\migrate-database.js
) else (
    REM Fall back to the old migration if new one doesn't exist
    echo Running standard migration...
    node tools\smart-migrate-database.js
)

echo.
pause
