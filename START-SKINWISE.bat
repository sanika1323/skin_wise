@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Dependencies missing. Run INSTALL-WINDOWS.bat first.
  pause
  exit /b 1
)
if not exist server\node_modules (
  echo Backend dependencies missing. Run INSTALL-WINDOWS.bat first.
  pause
  exit /b 1
)
start "SkinWise API - port 4000" cmd /k "cd /d "%~dp0server" && npm run dev"
timeout /t 2 /nobreak >nul
start "SkinWise Frontend - Vite" cmd /k "cd /d "%~dp0" && npm run dev"
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:5173
