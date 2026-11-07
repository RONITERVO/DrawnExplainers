@echo off
title DrawnExplainers Dashboard & Drive Sync (Port 3456)
cd /d "d:\Projects\Apps\DrawnExplainers"
echo ====================================================
echo Starting DrawnExplainers Dashboard & Drive Sync...
echo Dashboard URL: http://localhost:3456
echo This window runs independently of Antigravity IDE.
echo You can minimize this window.
echo ====================================================
node dashboard/server.mjs
pause
