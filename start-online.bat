@echo off
rem Start game server + public tunnel (cloudflared)
cd /d "%~dp0"
start "game-server" cmd /c "node server.js"
timeout /t 2 /nobreak >nul
echo.
echo Starting public tunnel... look for the https://xxx.trycloudflare.com URL below,
echo share that URL with your friends to play together!
echo.
"C:\Users\Administrator\.workbuddy\tools\cloudflared.exe" tunnel --url http://localhost:3000 --no-autoupdate
