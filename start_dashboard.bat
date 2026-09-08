@echo off
title Industrial Fire Intelligence - NTRO SIH26162
echo ============================================================
echo      INDUSTRIAL FIRE INTELLIGENCE DASHBOARD LAUNCHER
echo ============================================================
echo Starting local zero-dependency server...
echo.
start http://localhost:3000
node dashboard/server.js
pause
