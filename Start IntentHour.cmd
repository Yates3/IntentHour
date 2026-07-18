@echo off
setlocal
cd /d "%~dp0"
title IntentHour Dev Server - http://127.0.0.1:4317
echo.
echo  IntentHour is starting on http://127.0.0.1:4317
echo  Keep this window open while you use the project.
echo  Press Ctrl+C to stop the server.
echo.
npm.cmd run dev -- --host 127.0.0.1
echo.
echo  IntentHour stopped. Review the message above if this was unexpected.
pause
