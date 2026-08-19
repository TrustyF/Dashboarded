# dashboard (Next.js + Docker migration scaffold)

See `MIGRATION_PLAN.md` for the full writeup. Quick orientation:

- Repo root - the Next.js app (replaces `dashboard_client` + `dashboard_server`).
  All Flask blueprints are ported to route handlers under `app/api/*`.
  `app/page.tsx` is a working Home page wired to live data, proving the pattern; the
  rest of the original Vue views/components are intentionally left for you to port
  incrementally (see MIGRATION_PLAN.md §3).
- `sensor_poller/` - the one piece that stays Python, because DHT22/GPIO access has no
  Node equivalent. Writes readings to a shared file; the Next.js app just reads it.
- `docker-compose.yml` - two services (`app`, `sensor-poller`), volumes for
  tokens/secrets and the shared sensor data, host device mounts for CPU temp/voltage
  and screen brightness.

## Local dev (no Docker)

```sh
cp .env.local.example .env.local.local   # fill in real values
npm install
npm run dev
```

`vitals` and `settings/toggle-brightness` will fail gracefully off-Pi (no
`/sys/class/thermal`, no `vcgencmd`, no `brightnessctl`) rather than crashing.
`sensor_poller/poll.py` falls back to randomized readings off-Pi the same way the
original Flask code did when `adafruit_dht` failed to import.

## Building for the Pi

The Pi is too weak to build the images on-device (`next build` and compiling
`RPi.GPIO`'s C extension are both slow/heavy there). Instead, build on your dev
machine (cross-compiled for `linux/arm64` via `docker buildx`) and ship the
images straight to the Pi over `scp` + `docker load` - no registry needed:

```sh
.\scripts\deploy-to-pi.ps1
```

Use `-SkipApp` or `-SkipSensorPoller` to rebuild/redeploy just one image. Pass
`-PiHost`/`-PiPath` if your Pi's hostname or the compose project's directory on
it differ from the defaults (`arthur@dashboard`, `~/Dashboarded`). Requires
`ssh`/`scp` access to the Pi and Docker Desktop's buildx (already set up if
`docker buildx version` works).

The app's `npm ci`/`next build` stages run natively (not emulated) since the
project has no arch-specific deps - only the final runtime image is actually
arm64, so cross-building shouldn't feel much slower than a normal build. If it
still does, bump Docker Desktop's CPU/RAM allocation under Settings → Resources.

## Kiosk display (showing it on the Pi's own screen)

`pi-setup/` sets up a fullscreen kiosk pointed at `http://localhost:3000` using
`labwc` (Raspberry Pi's own Wayland compositor - properly patched for their
GPU driver stack, which matters: `cage` was tried first and hit an
unresolved EGL/wlroots incompatibility on real hardware) + Chromium, launched
via console autologin rather than a systemd service. Run once on the Pi:

```sh
cd pi-setup
sudo ./install.sh          # installs labwc+chromium, sets up autologin+autostart
sudo reboot
```

Rotation for the target panel (DSI, native portrait, rotated 90deg CCW to an
effective 1280x720 landscape) is baked into `pi-setup/labwc-autostart` via
`wlr-randr` - if your hardware differs, that's the file to change.

Since labwc/Chromium run as a login shell rather than a systemd service,
there's no `journalctl -u ...` to tail - check the actual screen, or:
```sh
journalctl -b | grep -iE 'labwc|chromium'
```

## Before going further

1. Move the hardcoded Google OAuth client_id/secret out of `calendar_bp.py` (see
   MIGRATION_PLAN.md §5) and rotate them if this repo has ever been pushed anywhere
   with them inline - do this regardless of whether you finish the migration.
2. Populate `.env.production` (not committed) with the real secrets,
   pointing token paths at `/data/tokens/...` to match the compose volume.
3. Run the one-time OAuth bootstrap on a machine with a browser (your laptop, not the
   Pi - refresh tokens aren't tied to the machine that requested them):
   ```sh
   npm run bootstrap-tokens -- google    # opens a browser, writes google_refresh_token.json
   npm run bootstrap-tokens -- fitbit    # opens a browser, prompts you to paste a code
   npm run bootstrap-tokens -- spotify   # opens a browser, writes .spotify_cache
   # or: npm run bootstrap-tokens -- all
   ```
   This writes the token files under `./data/tokens/` (reads client IDs/secrets and
   `*_TOKEN_PATH` from `.env`). For the Pi: copy that folder's contents into the
   `dashboard-tokens` volume (e.g. `docker compose cp data/tokens/. app:/data/tokens/`
   after first `up`, or `scp` them onto the host path the volume maps to) - you don't
   need to repeat the browser flow there.
