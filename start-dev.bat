@echo off
echo ========================================
echo   Eugene Mierak Portfolio - Dev Server
echo ========================================
echo.

cd /d "C:\Users\Usuario\.gemini\antigravity\playground\silent-feynman"

echo Starting local server...
echo.
echo Preview:  http://localhost:3000/preview.html
echo Landing:  http://localhost:3000/index.html
echo Projects: http://localhost:3000/projects.html
echo.

:: Wait 2 seconds for server to start, then open browser
start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000/preview.html"

:: Run the server (this will keep the window open)
npx -y serve . -p 3000
