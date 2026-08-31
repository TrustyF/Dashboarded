<#
.SYNOPSIS
  Builds the dashboard images locally (cross-compiled for the Pi's linux/arm64)
  and ships them to the Pi via scp + docker load, instead of building on-device.

.EXAMPLE
  .\scripts\deploy-to-pi.ps1
  .\scripts\deploy-to-pi.ps1 -SkipApp              # only rebuild sensor-poller
  .\scripts\deploy-to-pi.ps1 -PiHost pi@192.168.1.50 -PiPath /home/pi/dashboarded
  .\scripts\deploy-to-pi.ps1 -SyncTokens           # also push ./data/tokens/* after a bootstrap-tokens run
#>
param(
    [string]$PiHost = "arthur@dashboard",
    [string]$PiPath = "~/dashboarded",
    [switch]$SkipApp,
    [switch]$SkipSensorPoller,
    # Opt-in, not automatic: data/tokens/.spotify_cache gets rewritten in
    # place by the running container on every access-token refresh (see
    # bootstrap-tokens.mjs), so syncing it on every routine deploy would
    # clobber a live-refreshed token with a stale local copy. Only pass this
    # right after running `npm run bootstrap-tokens` for a service that
    # actually needs re-authing.
    [switch]$SyncTokens
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

if ($tarNames.Count -eq 0 -and -not $SyncTokens) {
    Write-Host "Nothing to deploy (both -SkipApp and -SkipSensorPoller set, and -SyncTokens not given)."
    exit 0
}

ssh $PiHost "mkdir -p $PiPath"
Invoke-Native "mkdir -p $PiPath on the Pi"

if ($tarNames.Count -gt 0) {
    # .env.local.production isn't in git (real secrets - see .gitignore); the
    # old GitHub Actions workflow used to re-copy it from
    # ~/secrets/dashboarded/ into place on every CI run. Now that
    # builds/deploys happen from here instead, this script is what keeps the
    # Pi's copy in sync - `docker compose up` requires this file to exist
    # (it's the app service's env_file).
    $envFile = Join-Path $repoRoot ".env.local.production"
    if (-not (Test-Path $envFile)) {
        throw ".env.local.production not found at $envFile - the Pi's app container needs this (env_file in docker-compose.yml). Restore it before deploying."
    }

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
} else {
    Write-Host "Skipping image build/deploy (-SkipApp -SkipSensorPoller) - syncing tokens against whatever is already running on the Pi."
}

if ($SyncTokens) {
    $localTokenDir = Join-Path $repoRoot "data\tokens"
    $tokenFiles = Get-ChildItem $localTokenDir -File -ErrorAction SilentlyContinue
    if (-not $tokenFiles) {
        Write-Host "SyncTokens: no files under $localTokenDir - nothing to sync."
    } else {
        Write-Host "Syncing $($tokenFiles.Count) token file(s) into the dashboard-tokens volume..."
        foreach ($file in $tokenFiles) {
            Copy-ToPi $file.FullName $PiPath
        }
        # Copy from the Pi's home path into the volume via the running
        # container, one file at a time (mirrors Copy-ToPi's reasoning above -
        # keeps remote-side quoting simple), then remove the transient copies
        # left in $PiPath. `docker compose cp` always writes as root inside
        # the container - fine for the read-only Google/Fitbit tokens, but
        # .spotify_cache needs to stay world-writable (0666) so the
        # container's non-root nextjs user can keep rewriting it in place, so
        # that one file gets an explicit chmod back afterward.
        $copyCmds = ($tokenFiles | ForEach-Object { "docker compose cp `"$($_.Name)`" app:/data/tokens/`"$($_.Name)`"" }) -join " && "
        $cleanupCmds = ($tokenFiles | ForEach-Object { "rm -f `"$($_.Name)`"" }) -join " && "
        # -u root: the container's default user (non-root nextjs) can't chmod
        # a file it doesn't own - docker compose cp above wrote it as root.
        $chmodCmd = if ($tokenFiles.Name -contains ".spotify_cache") { "&& docker compose exec -T -u root app chmod 666 /data/tokens/.spotify_cache" } else { "" }
        ssh $PiHost "cd $PiPath && $copyCmds $chmodCmd && $cleanupCmds"
        Invoke-Native "token sync"
        Write-Host "Token sync done."
    }
}

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
    # Piped over stdin to `bash -s` rather than passed as a command-line
    # argument - PowerShell 5.1's argument-to-native-exe escaping mangles a
    # string with this much embedded quoting/parens ($(seq...), the quoted
    # echo message), which showed up as the remote shell choking on a
    # `(` it should never have seen. Stdin sidesteps that escaping entirely.
    $reloadCmd = 'for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 1; done; ' +
                 'python3 /usr/local/bin/reload-dashboard.py || echo "reload-dashboard: skipped (kiosk not reachable, or not set up on this install)"'
    $reloadCmd | ssh $PiHost bash -s
}

Remove-Item -Recurse -Force $tmpDir

Write-Host "Done."
