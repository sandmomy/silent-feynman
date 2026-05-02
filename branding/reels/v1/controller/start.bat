@echo off
REM Frequency Vibes Reels Controller launcher
REM Starts a local server (port 8766) that serves the controller HTML
REM and proxies to Higgs (5757) + ComfyUI (8188).

cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  set PY=python
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set PY=py
  ) else (
    echo Python not found. Install Python from https://www.python.org/downloads/
    pause
    exit /b 1
  )
)

echo.
echo ===================================================
echo  Frequency Vibes Reels Controller
echo ===================================================
echo  http://localhost:8766/index.html
echo.
echo  Make sure Higgs   is running at http://127.0.0.1:5757
echo  Make sure ComfyUI is running at http://127.0.0.1:8188
echo.
echo  Leave this window OPEN while you work.
echo  Close this window to stop the server.
echo ===================================================
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8766/index.html"

%PY% server.py
