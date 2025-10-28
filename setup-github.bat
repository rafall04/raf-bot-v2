@echo off
echo Setting up GitHub repository...
echo.
echo Pastikan Anda sudah membuat repository di GitHub terlebih dahulu!
echo.
set /p username="Masukkan GitHub username: "
set /p reponame="Masukkan nama repository (default: raf-bot-v2): "
if "%reponame%"=="" set reponame=raf-bot-v2

echo.
echo Adding remote origin...
git remote add origin https://github.com/%username%/%reponame%.git

echo.
echo Pushing to GitHub...
git branch -M main
git push -u origin main

echo.
echo ✅ Repository berhasil di-upload ke GitHub!
echo.
pause
