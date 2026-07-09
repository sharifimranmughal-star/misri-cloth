@echo off
title MISRI CLOTH - Push updates to GitHub
cd /d "%~dp0"
color 0E

echo.
echo  Uploading your latest website changes to GitHub...
echo  (Render will update after you Manual Deploy)
echo.

git add -A
git -c user.email="sharifimranm@gmail.com" -c user.name="Imran Sabir" commit -m "Update site: free shipping, postgres orders, fixes" 2>nul
git push origin main

if errorlevel 1 (
  echo.
  echo  Push failed. Sign in to GitHub when browser opens, then run this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo  SUCCESS! Code uploaded to GitHub.
echo.
echo  Now on Render.com:
echo    1. Open misri-cloth service
echo    2. Manual Deploy - Deploy latest commit
echo    3. Check Environment has DATABASE_URL set
echo.
pause
