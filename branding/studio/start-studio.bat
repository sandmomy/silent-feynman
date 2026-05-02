@echo off
REM Frequency Vibes Studio launcher
REM Starts a local Python HTTP server so the studio can read images
REM without file:// CORS issues, then opens the browser.

cd /d "%~dp0"

REM ---------- Sync client photos into the studio ----------
REM Source: Desktop/video imagen istaram/  (3 levels up)
REM Target: studio/_assets/photos/
if not exist "_assets\photos" mkdir "_assets\photos"
echo Syncing client photos...
xcopy "..\..\..\video imagen istaram\*.jpeg" "_assets\photos\" /D /Y /Q >nul 2>&1
xcopy "..\..\..\video imagen istaram\*.jpg" "_assets\photos\" /D /Y /Q >nul 2>&1
xcopy "..\..\..\video imagen istaram\*.png" "_assets\photos\" /D /Y /Q >nul 2>&1

REM ---------- Find Python ----------
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

set PORT=8765

echo.
echo ===================================================
echo  Frequency Vibes Studio
echo ===================================================
echo  http://localhost:%PORT%/index.html
echo.
echo  Leave this window OPEN while you work.
echo  Close this window to stop the server.
echo ===================================================
echo.

start "" cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:%PORT%/index.html"

%PY% -m http.server %PORT%
