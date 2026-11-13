$ErrorActionPreference = 'Stop'
$entry = Join-Path $PSScriptRoot 'main.py'
if (-not (Test-Path -LiteralPath $entry)) { throw 'Desktop entry file is missing.' }
$candidates = @()
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) { $candidates += $pythonCommand.Source }
$candidates += @('E:\Anaconda3\python.exe', 'D:\Anaconda3\python.exe')
foreach ($pythonPath in ($candidates | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $pythonPath)) { continue }
    if ($pythonPath -like '*\WindowsApps\*') { continue }
    & $pythonPath -c 'import tkinter' 2>$null
    if ($LASTEXITCODE -ne 0) { continue }
    $pythonWindowed = Join-Path (Split-Path -Parent $pythonPath) 'pythonw.exe'
    if (-not (Test-Path -LiteralPath $pythonWindowed)) { continue }
    $quotedEntry = '"' + $entry + '"'
    $process = Start-Process -FilePath $pythonWindowed -ArgumentList $quotedEntry -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
    if ($process.WaitForExit(1200)) { throw 'Desktop process exited during startup. Check desktop-companion/startup-error.log.' }
    exit 0
}
throw 'No Python installation with tkinter and pythonw.exe was found. Install Python with Tcl/Tk support, then retry.'
