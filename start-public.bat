@echo off
title MISRI CLOTH - Starting...
cd /d "%~dp0"

echo.
echo  ========================================
echo   MISRI CLOTH - Starting website...
echo  ========================================
echo.

start "MISRI CLOTH Server" cmd /k "cd /d %~dp0 && npm start"

echo  Waiting for server to start...
timeout /t 4 /nobreak >nul

echo.
echo  Creating public link (share this on WhatsApp)...
echo  Keep this window OPEN for customers to access your site.
echo.

npx --yes cloudflared tunnel --url http://localhost:3000

pause
