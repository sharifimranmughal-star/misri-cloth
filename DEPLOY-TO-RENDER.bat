@echo off
title MISRI CLOTH - Deploy to Render (Permanent Link)
cd /d "%~dp0"
color 0A

echo.
echo  ============================================================
echo   MISRI CLOTH - Permanent Website Deployment
echo   Get a FREE 24/7 link like: https://misri-cloth.onrender.com
echo  ============================================================
echo.

REM --- Step 1: GitHub ---
echo  STEP 1 of 3: Create GitHub repository
echo  -------------------------------------
echo  A browser will open. On GitHub:
echo    - Repository name: misri-cloth
echo    - Keep it Public
echo    - Do NOT add README (leave empty)
echo    - Click "Create repository"
echo.
pause
start https://github.com/new

echo.
set /p GHUSER=Enter your GitHub username (e.g. sharifimran): 

if "%GHUSER%"=="" (
  echo Error: Username required.
  pause
  exit /b 1
)

git branch -M main 2>nul
git remote remove origin 2>nul
git remote add origin https://github.com/%GHUSER%/misri-cloth.git

echo.
echo  Pushing code to GitHub...
echo  (If asked, sign in to GitHub in the browser window)
echo.
git push -u origin main

if errorlevel 1 (
  echo.
  echo  Push failed. Try these commands manually in this folder:
  echo    git remote add origin https://github.com/%GHUSER%/misri-cloth.git
  echo    git push -u origin main
  echo.
  pause
  exit /b 1
)

echo.
echo  SUCCESS! Code uploaded to GitHub.
echo.

REM --- Step 2: Render ---
echo  STEP 2 of 3: Deploy on Render.com
echo  -------------------------------------
echo  Browser opening Render.com...
echo  On Render:
echo    1. Sign up free (use GitHub login)
echo    2. Click "New +" then "Web Service"
echo    3. Connect your GitHub - select "misri-cloth" repo
echo    4. Settings should auto-fill from render.yaml:
echo       - Name: misri-cloth
echo       - Build: npm install
echo       - Start: npm start
echo    5. Click "Create Web Service"
echo    6. Wait 2-3 minutes for deploy
echo    7. Your permanent link appears at top!
echo.
pause
start https://dashboard.render.com/select-repo?type=web

echo.
echo  STEP 3 of 3: Share your link
echo  -------------------------------------
echo  After deploy finishes, your link will be:
echo    https://misri-cloth.onrender.com
echo    (or similar - shown on Render dashboard)
echo.
echo  Share on WhatsApp! Works on all phones 24/7.
echo  Admin: YOUR-LINK/admin/orders.html  Password: misri2026
echo.
echo  Done! Press any key to close.
pause >nul
