@echo off
setlocal
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer must be installed and on PATH.
  pause
  exit /b 1
)
node.exe "%~dp0tools\launch-notebook.mjs" %*
set "RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %RESULT%
