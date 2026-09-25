param([Parameter(Mandatory=$true)][int]$ProcessId)
$ErrorActionPreference = 'Stop'
$targetProcess = Get-Process -Id $ProcessId
if ($targetProcess.ProcessName -ne 'electron') { throw 'The connected process is not the recruitment Electron app.' }
$targetHandle = $targetProcess.MainWindowHandle
if ($targetHandle -eq [IntPtr]::Zero) { throw 'The recruitment app has no native window to restore.' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class QiuzhaoRestoreWindow {
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr handle);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr handle, int command);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
}
'@
$wasMinimized = [QiuzhaoRestoreWindow]::IsIconic($targetHandle)
if ($wasMinimized) { [void][QiuzhaoRestoreWindow]::ShowWindowAsync($targetHandle,9) }
$activated = [QiuzhaoRestoreWindow]::SetForegroundWindow($targetHandle)
[pscustomobject]@{ wasMinimized=$wasMinimized; foregroundRequested=$activated } | ConvertTo-Json -Compress
