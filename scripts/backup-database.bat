@echo off
:: Simple database backup before migration
:: Usage: backup-database.bat

setlocal enabledelayedexpansion

echo ========================================
echo     DATABASE BACKUP UTILITY
echo ========================================
echo.

:: Get timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/: " %%a in ("%TIME%") do (set mytime=%%a%%b)
set mytime=%mytime: =0%
set TIMESTAMP=%mydate%_%mytime%

:: Create backup directory
set BACKUP_DIR=%~dp0..\database\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Backup SQLite database
set DB_FILE=%~dp0..\database\database.sqlite
set BACKUP_FILE=%BACKUP_DIR%\database_backup_%TIMESTAMP%.sqlite

if exist "%DB_FILE%" (
    echo Backing up database...
    copy "%DB_FILE%" "%BACKUP_FILE%" >nul
    echo ✓ Database backed up to:
    echo   %BACKUP_FILE%
) else (
    echo ⚠ Database file not found at:
    echo   %DB_FILE%
)

:: Backup JSON files
echo.
echo Backing up JSON files...
set JSON_COUNT=0
for %%f in (%~dp0..\database\*.json) do (
    copy "%%f" "%BACKUP_DIR%\%%~nxf_%TIMESTAMP%%%~xf" >nul 2>&1
    set /a JSON_COUNT+=1
)
echo ✓ Backed up %JSON_COUNT% JSON files

echo.
echo ========================================
echo     BACKUP COMPLETED
echo ========================================
echo Location: %BACKUP_DIR%
echo.
pause
