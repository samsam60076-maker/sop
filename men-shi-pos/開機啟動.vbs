Option Explicit
Dim sh, fso, dir, startup, lnk, skip, sc, action, ts, desktop, deskLnk
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
startup = sh.SpecialFolders("Startup")
lnk = startup & "\門市POS開店.lnk"
desktop = sh.SpecialFolders("Desktop")
deskLnk = desktop & "\門市 POS.lnk"
skip = dir & "\不要開機啟動.txt"
action = ""
If WScript.Arguments.Count > 0 Then action = LCase(Trim(WScript.Arguments(0)))

If action = "unregister" Then
  If fso.FileExists(lnk) Then fso.DeleteFile lnk, True
  Set ts = fso.CreateTextFile(skip, True)
  ts.WriteLine "刪掉這個檔，下次開店會再加入開機啟動。"
  ts.Close
  WScript.Quit 0
End If

If action = "register" Then
  If fso.FileExists(skip) Then fso.DeleteFile skip, True
  MakeShortcut
  MakeDesktop
  WScript.Quit 0
End If

If action = "desktop" Then
  MakeDesktop
  WScript.Quit 0
End If

If action = "ensure" Then
  If Not fso.FileExists(skip) Then MakeShortcut
  MakeDesktop
  WScript.Quit 0
End If

WScript.Quit 1

Sub MakeShortcut
  Set sc = sh.CreateShortcut(lnk)
  sc.TargetPath = dir & "\開店.bat"
  sc.Arguments = "boot"
  sc.WorkingDirectory = dir
  sc.WindowStyle = 7
  sc.Description = "開機後自動開 門市 POS"
  sc.Save
End Sub

Sub MakeDesktop
  Set sc = sh.CreateShortcut(deskLnk)
  sc.TargetPath = dir & "\開店.bat"
  sc.WorkingDirectory = dir
  sc.WindowStyle = 1
  sc.Description = "點一下開門市收銀"
  sc.Save
End Sub
