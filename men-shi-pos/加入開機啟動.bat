@echo off
chcp 65001 >nul
cd /d "%~dp0"
cscript //nologo "%~dp0開機啟動.vbs" register
if errorlevel 1 (
  echo 加入開機啟動失敗。
  pause
  exit /b 1
)
echo 已加入開機啟動。這台電腦開機後會自動開店。
echo 桌面已有「門市 POS」，點它就能收銀。
echo 不要存聊天裡的臨時網址。
echo 若不要自動開，雙擊「取消開機啟動.bat」。
if /i not "%~1"=="silent" pause
