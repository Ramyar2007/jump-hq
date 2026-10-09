@echo off
title Jump HQ
cd /d "%~dp0"
echo Starting Jump HQ on http://localhost:4777 ...
start "" http://localhost:4777
node server\index.js
pause
