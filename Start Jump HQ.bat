@echo off
title Jump HQ
cd /d "%~dp0"
rem Already running? Just open it.
curl -s -m 2 http://127.0.0.1:4777/api/ping >nul 2>&1 && (start "" http://localhost:4777 & exit /b)

rem 1. Node.js is needed to run Jump HQ.
where node >nul 2>&1
if errorlevel 1 (
  echo Jump HQ needs Node.js 20 or newer. The download page is opening now.
  echo Install it, then double-click "Start Jump HQ" again.
  start "" https://nodejs.org/en/download
  pause
  exit /b
)

rem 2. First start on this computer: install the parts Jump HQ uses (one time, about a minute).
if not exist "node_modules\express" (
  echo First start: setting up Jump HQ. This takes about a minute, only once...
  call npm install --omit=dev --no-audit --no-fund
)

rem 3. The AI team runs on Claude Code. Without it the dashboard still opens and Settings shows how to connect it.
where claude >nul 2>&1
if errorlevel 1 if not exist "%USERPROFILE%\.local\bin\claude.exe" (
  echo.
  echo Note: Claude Code is not installed yet, so the AI team cannot work.
  echo Open Settings, then Connections, then "AI brain" in the dashboard for the steps.
  echo.
)

echo Starting Jump HQ on http://localhost:4777 ...
echo Keep this window open. The AI team, schedules and the phone link run while it is open.
start "" http://localhost:4777
node server\index.js
pause
