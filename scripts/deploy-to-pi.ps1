<#
.SYNOPSIS
  Builds the dashboard images locally (cross-compiled for the Pi's linux/arm64)
  and ships them to the Pi via scp + docker load, instead of building on-device.

.EXAMPLE
  .\scripts\deploy-to-pi.ps1
  .\scripts\deploy-to-pi.ps1 -SkipApp              # only rebuild sensor-poller
  .\scripts\deploy-to-pi.ps1 -PiHost pi@192.168.1.50 -PiPath /home/pi/dashboarded
#>
param(
    [string]$PiHost = "arthur@dashboard",
    [string]$PiPath = "~/dashboarded",
    [switch]$SkipApp,
    [switch]$SkipSensorPoller
)

$ErrorActionPreference = "Stop"

# scp/ssh are external executables - PowerShell's $ErrorActionPreference only
# governs its own cmdlets/terminating errors, not their exit codes. Without
# this check a failed scp (or ssh) logs an error to the console but the
# script barrels on to the next step regardless.
function Invoke-Native {
    param([string]$Description)
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed (exit code $LASTEXITCODE)"
    }
}

# Windows' OpenSSH scp.exe misparses multiple "C:\..." local sources passed
# in a single invocation (a drive letter gets mistaken for a remote host
# spec - "stat local "C": No such file or directory"). Copying one file per
# scp call sidesteps the ambiguity entirely.
function Copy-ToPi {
    param([string]$LocalPath, [string]$RemoteDir)
    scp $LocalPath "${PiHost}:${RemoteDir}/"
    Invoke-Native "scp of $LocalPath"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$tmpDir = Join-Path $env:TEMP "dashboarded-deploy"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$tarNames = @()

if (-not $SkipApp) {
    Write-Host "Building dashboard-next:latest (linux/arm64)..."
    docker buildx build --platform linux/arm64 -t dashboard-next:latest --load $repoRoot
    Invoke-Native "dashboard-next build"
    Write-Host "Saving dashboard-next.tar..."
    docker save dashboard-next:latest -o (Join-Path $tmpDir "dashboard-next.tar")
    Invoke-Native "dashboard-next save"
    $tarNames += "dashboard-next.tar"
}

if (-not $SkipSensorPoller) {
    Write-Host "Building dashboard-sensor-poller:latest (linux/arm64)..."
    docker buildx build --platform linux/arm64 -t dashboard-sensor-poller:latest --load (Join-Path $repoRoot "sensor_poller")
    Invoke-Native "dashboard-sensor-poller build"
    Write-Host "Saving dashboard-sensor-poller.tar..."
    docker save dashboard-sensor-poller:latest -o (Join-Path $tmpDir "dashboard-sensor-poller.tar")
    Invoke-Native "dashboard-sensor-poller save"
    $tarNames += "dashboard-sensor-poller.tar"
}

if ($tarNames.Count -eq 0) {
    Write-Host "Nothing to deploy (both -SkipApp and -SkipSensorPoller set)."
    exit 0
}

# .env.local.production isn't in git (real secrets - see .gitignore); the old
# GitHub Actions workflow used to re-copy it from ~/secrets/dashboarded/ into
# place on every CI run. Now that builds/deploys happen from here instead,
# this script is what keeps the Pi's copy in sync - `docker compose up`
# requires this file to exist (it's the app service's env_file).
$envFile = Join-Path $repoRoot ".env.local.production"
if (-not (Test-Path $envFile)) {
    throw ".env.local.production not found at $envFile - the Pi's app container needs this (env_file in docker-compose.yml). Restore it before deploying."
}

ssh $PiHost "mkdir -p $PiPath"
Invoke-Native "mkdir -p $PiPath on the Pi"

Write-Host "Copying image(s), docker-compose.yml, and .env.local.production to ${PiHost}:${PiPath} ..."
foreach ($tarName in $tarNames) {
    Copy-ToPi (Join-Path $tmpDir $tarName) $PiPath
}
Copy-ToPi (Join-Path $repoRoot "docker-compose.yml") $PiPath
Copy-ToPi $envFile $PiPath

Write-Host "Loading image(s) and restarting containers on the Pi..."
$loadCmds = ($tarNames | ForEach-Object { "docker load -i $_" }) -join " && "
$rmCmds = ($tarNames | ForEach-Object { "rm -f $_" }) -join " && "
ssh $PiHost "cd $PiPath && $loadCmds && $rmCmds && docker compose up -d"
Invoke-Native "ssh deploy step"

if (-not $SkipApp) {
    # The kiosk's chromium tab (pi-setup/labwc-autostart) was already open
    # before this deploy and just keeps running whatever JS it first loaded -
    # a container restart alone doesn't touch it. reload-dashboard.py (via
    # CDP, see labwc-autostart) tells that exact tab to reload in place,
    # rather than killing/relaunching chromium: it has no supervisor, so a
    # kill would leave the screen dead until someone power-cycles the Pi.
    # Not a deploy failure if this doesn't work (kiosk not running, CDP not
    # set up yet on an older install, etc.) - the app itself already deployed
    # fine either way.
    Write-Host "Waiting for the app to come back up, then reloading the kiosk tab..."
    $reloadCmd = 'for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 1; done; ' +
                 'python3 /usr/local/bin/reload-dashboard.py || echo "reload-dashboard: skipped (kiosk not reachable, or not set up on this install)"'
    ssh $PiHost $reloadCmd
}

Remove-Item -Recurse -Force $tmpDir

Write-Host "Done."
