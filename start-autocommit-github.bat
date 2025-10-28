@echo off
color 0A
cls

echo ========================================================
echo         RAF-BOT v2 AUTO-COMMIT to GITHUB
echo ========================================================
echo.
echo Repository: https://github.com/rafall04/raf-bot-v2
echo Branch: main
echo.
echo Fitur:
echo - Monitor perubahan file secara real-time
echo - Auto-commit setiap 10 detik setelah ada perubahan
echo - Auto-push ke GitHub
echo - Skip file sensitif (config.json, database, dll)
echo.
echo ========================================================
echo.
echo Tekan Ctrl+C untuk stop service
echo.

:: Start the auto-commit service
npm run auto-commit

pause
