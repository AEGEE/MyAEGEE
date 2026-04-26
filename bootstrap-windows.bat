@echo off
REM MyAEGEE Windows bootstrap launcher.
REM Double-click this file (or right-click > Run as administrator) to set up
REM WSL2 + Docker for local development. The PowerShell script will request
REM admin privileges via UAC if needed.

setlocal
set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%scripts-windows\bootstrap-windows.ps1"

if not exist "%PS_SCRIPT%" (
    echo ERROR: cannot find %PS_SCRIPT%
    echo Make sure you are running this file from inside the cloned MyAEGEE repository.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
endlocal
