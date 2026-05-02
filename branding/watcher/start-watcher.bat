@echo off
REM Frequency Vibes — image watcher launcher
REM Auto-installs deps if missing, then runs the watcher.

cd /d "%~dp0"

REM ---------- Find Python ----------
where python >nul 2>nul
if %errorlevel%==0 (
  set PY=python
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set PY=py
  ) else (
    echo Python not found. Install from https://www.python.org/downloads/
    pause
    exit /b 1
  )
)

REM ---------- Ensure dependencies ----------
%PY% -c "import PIL" 2>nul
if %errorlevel% neq 0 (
  echo Installing Pillow...
  %PY% -m pip install --quiet --user Pillow
)
%PY% -c "import winotify" 2>nul
if %errorlevel% neq 0 (
  echo Installing winotify ^(toast notifications^)...
  %PY% -m pip install --quiet --user winotify
)

echo.
echo ==============================================================
echo  Frequency Vibes — Image Watcher
echo ==============================================================
echo  Watching:  C:\Users\Usuario\Pictures\imagnes try\
echo  Output:    .\_processed\ (whatsapp + HQ + IG versions)
echo.
echo  Drop a "ChatGPT Image*.png" in the watched folder
echo  -> 3 processed versions appear automatically (~2 sec).
echo.
echo  Leave this window OPEN while you work.
echo  Close it (or Ctrl+C) to stop the watcher.
echo ==============================================================
echo.

%PY% watch.py
pause
