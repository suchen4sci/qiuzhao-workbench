$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
$taskElectron = Join-Path $taskRepo 'node_modules\electron\dist\electron.exe'
$taskEntry = Join-Path $PSScriptRoot 'desktop-ai.cjs'
$taskPriorFlag = $env:ELECTRON_RUN_AS_NODE
try {
    $env:ELECTRON_RUN_AS_NODE = '1'
    $taskProcess = Start-Process -FilePath $taskElectron -ArgumentList ('"' + $taskEntry + '"') -WorkingDirectory $taskRepo -WindowStyle Hidden -PassThru -Wait
    if ($taskProcess.ExitCode -ne 0) {
        $taskResult = Get-Content -LiteralPath (Join-Path $env:APPDATA 'QiuzhaoWorkbench\desktop-ai-result.json') -Raw | ConvertFrom-Json
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($taskResult.message, '秋招一键补全与学习') | Out-Null
    }
} catch {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($_.Exception.Message, '秋招一键补全与学习') | Out-Null
} finally { $env:ELECTRON_RUN_AS_NODE = $taskPriorFlag }
