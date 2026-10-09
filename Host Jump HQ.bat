@echo off
title Jump HQ Cloud (public)
cd /d "%~dp0"
rem Hosts Jump HQ Cloud (sign-up site + one private Jump HQ per customer) from this computer
rem and gives it a public link through a free Cloudflare tunnel. Keep this window open.
where node >nul 2>&1
if errorlevel 1 (
  echo Jump HQ needs Node.js 20 or newer. The download page is opening now.
  start "" https://nodejs.org/en/download
  pause
  exit /b
)
if not exist "node_modules\express" call npm install --omit=dev --no-audit --no-fund
node scripts\host.mjs
pause
