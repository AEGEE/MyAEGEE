<#
.SYNOPSIS
    MyAEGEE Windows bootstrap script (WSL2 + Docker Desktop).

.DESCRIPTION
    Run this script ONCE on a Windows machine to prepare a local development
    environment for MyAEGEE. After it completes, open the Ubuntu app from the
    Start menu, clone the MyAEGEE repository inside the Linux home directory
    and run "./start.sh --wsl".

    What this script does:
      1. Verifies your Windows version supports WSL2.
      2. Installs WSL2 + Ubuntu if they are not already installed.
      3. Adds the MyAEGEE entries to the Windows hosts file.
      4. Reminds you to install Docker Desktop with the WSL2 backend.

    The script auto-elevates: if you launch it without admin rights it will
    re-launch itself with a UAC prompt.

.NOTES
    Requires Windows 10 build 19041 (May 2020 update / version 2004) or newer,
    or any Windows 11 build.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

#------------------------------------------------------------------------------
# Auto-elevation
#------------------------------------------------------------------------------
$currentUser = New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)
$isAdmin = $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Administrator privileges are required. Re-launching with elevation..." -ForegroundColor Yellow
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -Verb RunAs
    exit
}

#------------------------------------------------------------------------------
# Pretty-print helpers
#------------------------------------------------------------------------------
function Write-Section {
    param([string]$Text)
    Write-Host ''
    Write-Host "==> $Text" -ForegroundColor Cyan
}
function Write-Ok    { param([string]$Text) Write-Host "    [OK]   $Text" -ForegroundColor Green }
function Write-Warn2 { param([string]$Text) Write-Host "    [WARN] $Text" -ForegroundColor Yellow }
function Write-Err   { param([string]$Text) Write-Host "    [ERR]  $Text" -ForegroundColor Red }

#------------------------------------------------------------------------------
# Banner
#------------------------------------------------------------------------------
Write-Host ''
Write-Host '=========================================================' -ForegroundColor Cyan
Write-Host ' MyAEGEE bootstrap for Windows (WSL2 + Docker Desktop)'   -ForegroundColor Cyan
Write-Host '=========================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'This script will:'
Write-Host '  1. Verify your Windows version'
Write-Host '  2. Install WSL2 + Ubuntu (if not already installed)'
Write-Host '  3. Add MyAEGEE entries to your Windows hosts file'
Write-Host '  4. Check that Docker Desktop is installed'
Write-Host ''
[void](Read-Host 'Press ENTER to continue (or close this window to abort)')

#------------------------------------------------------------------------------
# 1. Windows version check
#------------------------------------------------------------------------------
Write-Section 'Checking Windows version'
$os    = Get-CimInstance Win32_OperatingSystem
$build = [int]$os.BuildNumber
if ($build -lt 19041) {
    Write-Err "Windows build $build is too old. WSL2 requires build 19041 (Windows 10 v2004) or newer."
    Write-Err 'Please run Windows Update first, then re-launch this script.'
    [void](Read-Host 'Press ENTER to exit')
    exit 1
}
Write-Ok "Windows build $build supports WSL2."

#------------------------------------------------------------------------------
# 2. WSL2 installation
#------------------------------------------------------------------------------
Write-Section 'Checking WSL2'

$wslExe       = Get-Command wsl.exe -ErrorAction SilentlyContinue
$needsInstall = $false

if (-not $wslExe) {
    $needsInstall = $true
} else {
    $null = & wsl.exe --status 2>$null
    if ($LASTEXITCODE -ne 0) {
        $needsInstall = $true
    }
}

if ($needsInstall) {
    Write-Warn2 'WSL2 is not installed. Installing now (this can take several minutes)...'
    & wsl.exe --install
    if ($LASTEXITCODE -ne 0) {
        Write-Err 'wsl --install failed. Check the output above for details.'
        Write-Err 'You can also try installing WSL manually: https://learn.microsoft.com/windows/wsl/install'
        [void](Read-Host 'Press ENTER to exit')
        exit 1
    }
    Write-Host ''
    Write-Warn2 'WSL2 has been installed but Windows MUST be restarted to finish setup.'
    Write-Warn2 'After the restart, log in to your account and re-run this script.'
    [void](Read-Host 'Press ENTER to exit')
    exit 0
}
Write-Ok 'WSL2 is available.'

#------------------------------------------------------------------------------
# Linux distribution check
#------------------------------------------------------------------------------
Write-Section 'Checking installed Linux distributions'

# wsl.exe sometimes emits UTF-16 with null bytes; clean them up to be safe.
$rawDistros = & wsl.exe --list --quiet 2>$null
$distros    = $rawDistros |
    ForEach-Object { ($_ -replace "`0", '').Trim() } |
    Where-Object   { $_ -ne '' }

if (-not $distros -or $distros.Count -eq 0) {
    Write-Warn2 'No Linux distribution found. Installing Ubuntu...'
    & wsl.exe --install -d Ubuntu
    if ($LASTEXITCODE -ne 0) {
        Write-Err 'Failed to install Ubuntu. You can try manually: wsl --install -d Ubuntu'
        [void](Read-Host 'Press ENTER to exit')
        exit 1
    }
    Write-Ok 'Ubuntu installed.'
    Write-Host '         The very first time you launch Ubuntu from the Start menu,'
    Write-Host '         it will ask you to create a Linux username and password.'
} else {
    Write-Ok ("Found: " + ($distros -join ', '))
}

#------------------------------------------------------------------------------
# 3. Windows hosts file
#------------------------------------------------------------------------------
Write-Section 'Updating Windows hosts file'

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$hostsLine = '127.0.0.1 appserver.test my.appserver.test traefik.appserver.test portainer.appserver.test pgadmin.appserver.test'
$marker    = '# MyAEGEE local development'

$existing = ''
if (Test-Path -LiteralPath $hostsPath) {
    $existing = Get-Content -LiteralPath $hostsPath -Raw
}

if ($existing -match 'appserver\.test') {
    Write-Ok "Entries for appserver.test are already present in $hostsPath, skipping."
} else {
    if ($existing.Length -gt 0 -and -not $existing.EndsWith("`n")) {
        $existing += "`r`n"
    }
    $existing += "`r`n$marker`r`n$hostsLine`r`n"
    [System.IO.File]::WriteAllText($hostsPath, $existing, [System.Text.Encoding]::ASCII)
    Write-Ok "Added MyAEGEE entries to $hostsPath"
}

#------------------------------------------------------------------------------
# 4. Docker Desktop check
#------------------------------------------------------------------------------
Write-Section 'Checking Docker Desktop'

$dockerExe = Get-Command docker.exe -ErrorAction SilentlyContinue
if (-not $dockerExe) {
    Write-Warn2 'Docker Desktop is not installed (or docker.exe is not in PATH).'
    Write-Host ''
    Write-Host '    Please install Docker Desktop from:' -ForegroundColor Yellow
    Write-Host '      https://www.docker.com/products/docker-desktop/' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '    During installation, make sure "Use WSL 2 instead of Hyper-V" is selected.'
    Write-Host '    After installation, open Docker Desktop and go to:'
    Write-Host '      Settings > Resources > WSL Integration'
    Write-Host '    then enable integration with your Ubuntu distribution.'
    Write-Host ''
} else {
    Write-Ok "Docker Desktop binary found at: $($dockerExe.Path)"
    Write-Host '         Make sure that in Docker Desktop:'
    Write-Host '           Settings > Resources > WSL Integration'
    Write-Host '         your Ubuntu distribution is enabled.'
}

#------------------------------------------------------------------------------
# Final instructions
#------------------------------------------------------------------------------
Write-Host ''
Write-Host '=========================================================' -ForegroundColor Green
Write-Host ' Bootstrap complete. Next steps (inside Ubuntu/WSL2):'    -ForegroundColor Green
Write-Host '=========================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  1. Make sure Docker Desktop is running (whale icon in the tray).'
Write-Host '  2. Open the "Ubuntu" app from the Start menu.'
Write-Host '     (the very first time, it will ask you to create a Linux user)'
Write-Host ''
Write-Host '  3. Inside Ubuntu, clone the MyAEGEE repository in your HOME:'
Write-Host ''
Write-Host '       cd ~'                                                                         -ForegroundColor Cyan
Write-Host '       git clone --recursive https://github.com/AEGEE/MyAEGEE.git myaegee'           -ForegroundColor Cyan
Write-Host '       cd myaegee'                                                                   -ForegroundColor Cyan
Write-Host ''
Write-Host '     IMPORTANT: clone inside the Linux home (~/myaegee),'                            -ForegroundColor Yellow
Write-Host '     NOT under /mnt/c/. The latter is slow and breaks file permissions.'             -ForegroundColor Yellow
Write-Host ''
Write-Host '  4. Start the system:'
Write-Host ''
Write-Host '       ./start.sh --wsl'                                                             -ForegroundColor Cyan
Write-Host ''
Write-Host '     This takes 15-25 minutes the very first time.'
Write-Host ''
Write-Host '  5. When it finishes, open in your browser:'
Write-Host ''
Write-Host '       http://my.appserver.test'                                                     -ForegroundColor Cyan
Write-Host ''
[void](Read-Host 'Press ENTER to close this window')
