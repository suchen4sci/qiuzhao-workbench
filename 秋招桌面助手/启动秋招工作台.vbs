Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = fso.BuildPath(appDir, "node_modules\electron\dist\electron.exe")
If Not fso.FileExists(exePath) Then
  MsgBox "Electron runtime is missing. Run npm install in the application folder.", 48, "Qiuzhao Desktop"
  WScript.Quit 1
End If
shell.Environment("PROCESS").Remove "ELECTRON_RUN_AS_NODE"
shell.CurrentDirectory = appDir
nodePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not fso.FileExists(nodePath) Then
  MsgBox "Node.js runtime is missing.", 48, "Qiuzhao Desktop"
  WScript.Quit 1
End If
shell.Run Chr(34) & nodePath & Chr(34) & " " & Chr(34) & fso.BuildPath(appDir, "scripts\start.cjs") & Chr(34), 0, False
