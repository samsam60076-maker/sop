@echo off
chcp 65001 >nul
title 門市 POS
cd /d "%~dp0"

if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

if /i "%~1"=="boot" timeout /t 8 /nobreak >nul

curl.exe -fsS -o nul --max-time 2 http://127.0.0.1:3847 >nul 2>&1
if not errorlevel 1 (
  start "" "http://127.0.0.1:3847"
  echo 店已在開。瀏覽器請開 http://127.0.0.1:3847
  if /i "%~1"=="boot" exit /b 0
  timeout /t 4 >nul
  exit /b 0
)

where node >nul 2>&1
if errorlevel 1 (
  echo 這台電腦還沒裝開店程式。
  echo 請先安裝 Node.js，裝好後再點一次這個檔。
  start "" "https://nodejs.org/zh-tw/download"
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo 第一次開店，請等一下...
  call npm install
  if errorlevel 1 (
    echo 安裝失敗。
    pause
    exit /b 1
  )
)

if not exist ".next\" (
  echo 第一次開店，正在準備...
  call npm run build
  if errorlevel 1 (
    echo 準備失敗。
    pause
    exit /b 1
  )
)

cscript //nologo "%~dp0開機啟動.vbs" ensure >nul 2>&1

echo 店已開。瀏覽器請開 http://127.0.0.1:3847
echo 這台電腦開機後會自動開店。不要關這個黑畫面。
start "" "http://127.0.0.1:3847"
npm run start
