param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$dashboardUrl = 'http://127.0.0.1:33210/'
function Test-Dashboard {
    try {
        $response = Invoke-WebRequest -Uri $dashboardUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch { return $false }
}
try {
    if (-not (Test-Dashboard)) {
        $nodePath = 'C:\Program Files\nodejs\node.exe'
        if (-not (Test-Path -LiteralPath $nodePath)) {
            $nodePath = (Get-Command node -ErrorAction Stop).Source
        }
        $serverPath = Join-Path $PSScriptRoot 'server.mjs'
        $serverProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'startup.log') -RedirectStandardError (Join-Path $PSScriptRoot 'startup-error.log') -PassThru
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if (Test-Dashboard) { $ready = $true; break }
            if ($serverProcess.HasExited) { throw 'Server exited. See startup-error.log.' }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ready) { throw 'Server startup timed out. See startup-error.log.' }
    }
    if (-not $NoBrowser) { Start-Process $dashboardUrl }
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Dashboard startup failed') | Out-Null
    exit 1
}
