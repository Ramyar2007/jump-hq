@echo off
title Jump HQ
cd /d "%~dp0"
rem Already running? Just open it.
curl -s -m 2 http://127.0.0.1:4777/api/ping >nul 2>&1 && (start "" http://localhost:4777 & exit /b)
echo Starting Jump HQ on http://localhost:4777 ...
echo Keep this window open. The phone link and the AI team run while it is open.
start "" http://localhost:4777
node server\index.js
pause
