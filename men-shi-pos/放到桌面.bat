@echo off
chcp 65001 >nul
cd /d "%~dp0"
cscript //nologo "%~dp0開機啟動.vbs" desktop
if errorlevel 1 (
  echo 放到桌面失敗。
  pause
  exit /b 1
)
echo 桌面已有「門市 POS」。以後開機點它就能收銀。
echo 不要存聊天裡的臨時網址，那條隔夜會失效。
if /i not "%~1"=="silent" pause
