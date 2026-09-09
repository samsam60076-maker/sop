@echo off
chcp 65001 >nul
cd /d "%~dp0"
cscript //nologo "%~dp0開機啟動.vbs" unregister
if errorlevel 1 (
  echo 取消開機啟動失敗。
  pause
  exit /b 1
)
echo 已取消開機啟動。這台電腦重開機後不會自動開店。
echo 之後若要再開，雙擊「加入開機啟動.bat」或再點一次「開店.bat」。
pause
