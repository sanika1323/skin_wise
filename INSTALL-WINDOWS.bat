@echo off
setlocal
cd /d "%~dp0"
echo ======================================
echo SkinWise AI - Install frontend + API
echo ======================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 20 or newer from https://nodejs.org/ and reopen this file.
  pause
  exit /b 1
)
echo Installing frontend dependencies...
call npm install
if errorlevel 1 goto failed
cd server
echo Installing backend dependencies...
call npm install
if errorlevel 1 goto failed
cd ..
if not exist server\data\shelf.json echo []>server\data\shelf.json
echo.
echo Installation complete. Start the app with START-SKINWISE.bat
pause
exit /b 0
:failed
echo Installation failed. Read the error above and try again.
pause
exit /b 1
