<#
.SYNOPSIS
  Builds the dashboard images locally (cross-compiled for the Pi's linux/arm64)
  and ships them to the Pi via scp + docker load, instead of building on-device.

.EXAMPLE
  .\scripts\deploy-to-pi.ps1
  .\scripts\deploy-to-pi.ps1 -SkipApp              # only rebuild sensor-poller
  .\scripts\deploy-to-pi.ps1 -PiHost pi@192.168.1.50 -PiPath /home/pi/Dashboarded
#>
param(
    [string]$PiHost = "arthur@dashboard",
    [string]$PiPath = "~/Dashboarded",
    [switch]$SkipApp,
    [switch]$SkipSensorPoller
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$tmpDir = Join-Path $env:TEMP "dashboarded-deploy"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$tarNames = @()

if (-not $SkipApp) {
    Write-Host "Building dashboard-next:latest (linux/arm64)..."
    docker buildx build --platform linux/arm64 -t dashboard-next:latest --load $repoRoot
    Write-Host "Saving dashboard-next.tar..."
    docker save dashboard-next:latest -o (Join-Path $tmpDir "dashboard-next.tar")
    $tarNames += "dashboard-next.tar"
}

if (-not $SkipSensorPoller) {
    Write-Host "Building dashboard-sensor-poller:latest (linux/arm64)..."
    docker buildx build --platform linux/arm64 -t dashboard-sensor-poller:latest --load (Join-Path $repoRoot "sensor_poller")
    Write-Host "Saving dashboard-sensor-poller.tar..."
    docker save dashboard-sensor-poller:latest -o (Join-Path $tmpDir "dashboard-sensor-poller.tar")
    $tarNames += "dashboard-sensor-poller.tar"
}

if ($tarNames.Count -eq 0) {
    Write-Host "Nothing to deploy (both -SkipApp and -SkipSensorPoller set)."
    exit 0
}

Write-Host "Copying image(s) and docker-compose.yml to ${PiHost}:${PiPath} ..."
$filesToCopy = ($tarNames | ForEach-Object { Join-Path $tmpDir $_ }) + (Join-Path $repoRoot "docker-compose.yml")
scp @filesToCopy "${PiHost}:${PiPath}/"

Write-Host "Loading image(s) and restarting containers on the Pi..."
$loadCmds = ($tarNames | ForEach-Object { "docker load -i $_" }) -join " && "
$rmCmds = ($tarNames | ForEach-Object { "rm -f $_" }) -join " && "
ssh $PiHost "cd $PiPath && $loadCmds && $rmCmds && docker compose up -d"

Remove-Item -Recurse -Force $tmpDir

Write-Host "Done."
