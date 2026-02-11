@echo off
echo ========================================
echo Smart Hospital Backend Server Startup
echo ========================================
echo.
echo Step 1: Kill all existing node processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM npm.exe 2>nul
timeout /t 3 /nobreak
echo.
echo Step 2: Checking port 3000...
netstat -ano | find ":3000" >nul
if %ERRORLEVEL% EQU 0 (
    echo Port 3000 is in use! Killing process...
    for /f "tokens=5" %%A in ('netstat -ano ^| find ":3000"') do taskkill /PID %%A /F
    timeout /t 2 /nobreak
)
echo.
echo Step 3: Starting Node.js server on port 3000...
cd /d D:\SmartHospital\backend
node server.js
pause
