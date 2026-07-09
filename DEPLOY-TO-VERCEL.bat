@echo off
title MISRI CLOTH - Deploy to Vercel (FREE, No Card)
cd /d "%~dp0"
color 0B

echo.
echo  ============================================================
echo   MISRI CLOTH - Deploy FREE on Vercel
echo   NO credit card required!
echo  ============================================================
echo.
echo  Steps:
echo    1. Browser opens - Sign up FREE with GitHub or Email
echo    2. Come back here and press any key
echo    3. Follow Vercel prompts in this window
echo    4. You get a permanent link like:
echo       https://misri-cloth.vercel.app
echo.
pause
start https://vercel.com/signup

echo.
echo  Starting deployment...
echo  When asked:
echo    - Set up and deploy?  Y
echo    - Which scope?        Your account
echo    - Link to project?    N (new project)
echo    - Project name?       misri-cloth
echo    - Directory?          ./  (just press Enter)
echo.
echo  Login in browser if asked, then return here.
echo.

npx vercel --prod

echo.
echo  ============================================================
echo  DONE! Copy the link shown above (https://....vercel.app)
echo  Share it on WhatsApp - works on all phones 24/7!
echo.
echo  Admin: YOUR-LINK/admin/orders.html
echo  Password: misri2026
echo  ============================================================
echo.
pause
