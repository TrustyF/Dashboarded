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

```sh
docker buildx build --platform linux/arm64 -t dashboard-next:latest .
docker buildx build --platform linux/arm64 -t dashboard-sensor-poller:latest ./sensor_poller
# push both to a registry the Pi can pull from, then on the Pi:
docker compose pull && docker compose up -d
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
