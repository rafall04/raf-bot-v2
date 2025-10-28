@echo off
:: RAF-BOT v2 Auto-Commit Script
:: Automatically commits and pushes changes to GitHub

setlocal enabledelayedexpansion

:: Configuration
set "PROJECT_PATH=c:\project\raf-bot-v2"
set "COMMIT_PREFIX=Auto-commit:"
set "CHECK_INTERVAL=300"

:: Colors for output
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "NC=[0m"

echo %GREEN%==============================================%NC%
echo %GREEN%      RAF-BOT v2 Auto-Commit Service         %NC%
echo %GREEN%==============================================%NC%
echo.
echo %YELLOW%[INFO] Starting auto-commit service...%NC%
echo %YELLOW%[INFO] Check interval: %CHECK_INTERVAL% seconds%NC%
echo %YELLOW%[INFO] Project path: %PROJECT_PATH%%NC%
echo.

cd /d %PROJECT_PATH%

:loop
:: Check for changes
git status --porcelain > temp_status.txt
set /p status=<temp_status.txt
del temp_status.txt

if not "!status!"=="" (
    echo %GREEN%[%date% %time%] Changes detected!%NC%
    
    :: Add all changes
    git add .
    
    :: Create commit message with timestamp
    for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set mydate=%%d-%%b-%%c
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set mytime=%%a:%%b
    set "commit_msg=%COMMIT_PREFIX% %mydate% %mytime%"
    
    :: Commit changes
    git commit -m "!commit_msg!" > nul 2>&1
    if !errorlevel! equ 0 (
        echo %GREEN%[✓] Changes committed: !commit_msg!%NC%
        
        :: Push to remote
        git push origin main > nul 2>&1
        if !errorlevel! equ 0 (
            echo %GREEN%[✓] Changes pushed to GitHub%NC%
        ) else (
            echo %RED%[✗] Failed to push to GitHub. Will retry next cycle.%NC%
        )
    ) else (
        echo %YELLOW%[!] No changes to commit%NC%
    )
) else (
    echo [%date% %time%] No changes detected
)

:: Wait before next check
timeout /t %CHECK_INTERVAL% /nobreak > nul
goto loop
